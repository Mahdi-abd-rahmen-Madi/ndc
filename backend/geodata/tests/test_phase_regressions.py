import json
import threading
import time
from decimal import Decimal
from io import StringIO
from unittest.mock import MagicMock, patch

import geopandas as gpd
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import RequestFactory, SimpleTestCase, TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APIRequestFactory
from shapely.geometry import box

from geodata import ndc_generator, services, views
from geodata.models import (
    AntennaEquipment,
    AntennaSpecification,
    TerrainDocumentation,
    TerrainLoadCalculation,
)
from geodata.serializers import AntennaEquipmentListSerializer, AntennaEquipmentSerializer
from geodata.terrain.bdtopo import BDTOPOService
from geodata.terrain.spatial_metrics import aggregate_code_areas_to_percentages
from geodata.vector_tile_parser import VectorTileParser


class GeodataModularAndPerfUnitTests(SimpleTestCase):
    def test_backward_compatible_reexports(self):
        for sym in (
            "calculate_wind_params",
            "sanitize_assemblage_rtf",
            "_batch_convert_rtf_files",
            "find_job_equipment_rtf_paths",
            "extract_rrh_ndc_context",
            "extract_rru_ndc_context",
            "generate_ndc_pdf",
            "generate_auxiliary_pdfs",
        ):
            self.assertTrue(hasattr(ndc_generator, sym), f"Missing ndc_generator.{sym}")

        for sym in ("TerrainClassificationService", "BDTOPOService", "terrain_service", "bdtopo_service"):
            self.assertTrue(hasattr(services, sym), f"Missing services.{sym}")

        for sym in (
            "AntennaEquipmentViewSet",
            "TerrainClassificationViewSet",
            "TerrainConfigViewSet",
            "RegionGeoJSONViewSet",
            "GeocodingSearchViewSet",
            "HeightCalculationRequestViewSet",
            "NotificationViewSet",
            "terrain_classification_fast_api",
        ):
            self.assertTrue(hasattr(views, sym), f"Missing views.{sym}")

    def test_ec1_wind_calculation_and_rtf_sanitizer(self):
        import math

        self.assertEqual(
            ndc_generator.TERRAIN_Z0,
            {"0": 0.003, "II": 0.05, "IIIa": 0.2, "IIIb": 0.5, "IV": 1.0},
        )

        wind = ndc_generator.calculate_wind_params("IIIa", 25.0, 24.0)
        self.assertGreater(wind["qp_dan"], 0)
        self.assertGreater(wind["vm"], 0)
        self.assertEqual(wind["z_used"], 25.0)

        # No zmin clamping: z < old zmin (15 m for IV, 5 m for IIIa) uses exact z
        wind_iv_low = ndc_generator.calculate_wind_params("IV", 4.5, 24.0)
        self.assertEqual(wind_iv_low["z_used"], 4.5)
        kr_expected = 0.19 * (1.0 / 0.05) ** 0.07
        cr_expected = kr_expected * math.log(4.5 / 1.0)
        vm_expected = cr_expected * 24.0
        iv_expected = 1.0 / math.log(4.5 / 1.0)
        qp_dan_expected = ((1 + 7 * iv_expected) * 0.5 * 1.25 * vm_expected ** 2) / 10.0
        self.assertEqual(wind_iv_low["kr"], round(kr_expected, 2))
        self.assertEqual(wind_iv_low["cr_z"], round(cr_expected, 2))
        self.assertEqual(wind_iv_low["vm"], round(vm_expected, 2))
        self.assertEqual(wind_iv_low["iv_z"], round(iv_expected, 2))
        self.assertEqual(wind_iv_low["qp_dan"], round(qp_dan_expected, 2))

        wind_iiia_low = ndc_generator.calculate_wind_params("IIIa", 3.0, 24.0)
        self.assertEqual(wind_iiia_low["z_used"], 3.0)

        with self.assertRaises(ValueError):
            ndc_generator.calculate_wind_params("IV", 1.0, 24.0)

        # Exact z helper: sans_plot excludes h_plot; avec_plot includes h_plot
        self.assertEqual(ndc_generator.compute_wind_z(10.0, 2.0, h_plot=0.5, sans_plot=True), 12.0)
        self.assertEqual(ndc_generator.compute_wind_z(10.0, 2.0, h_plot=0.5, sans_plot=False), 12.5)
        self.assertEqual(ndc_generator.compute_wind_z(10.0, 2.0, "[PLOT_HEIGHT_M]", sans_plot=False), 12.0)

        # Support wind resolver respects sans_plot and uses unclamped z
        env_iv = {"building_height_m": 2.0, "terrain_type": "IV"}
        sp_wind = ndc_generator._resolve_support_wind_params(
            {}, {}, env_iv, 24, 0.5, 1.5, sans_plot=True
        )
        expected_sp = ndc_generator.calculate_wind_params("IV", 3.5, 24.0)
        self.assertEqual(sp_wind["cr_z"], expected_sp["cr_z"])
        self.assertEqual(sp_wind["vm_z"], expected_sp["vm"])
        self.assertEqual(sp_wind["iv_z"], expected_sp["iv_z"])
        self.assertEqual(sp_wind["kr_z"], expected_sp["kr"])
        self.assertEqual(sp_wind["qp_z"], expected_sp["qp_dan"])

        ap_wind = ndc_generator._resolve_support_wind_params(
            {}, {}, env_iv, 24, 0.5, 1.5, sans_plot=False
        )
        expected_ap = ndc_generator.calculate_wind_params("IV", 4.0, 24.0)
        self.assertEqual(ap_wind["cr_z"], expected_ap["cr_z"])
        self.assertEqual(ap_wind["vm_z"], expected_ap["vm"])
        self.assertEqual(ap_wind["iv_z"], expected_ap["iv_z"])
        self.assertEqual(ap_wind["kr_z"], expected_ap["kr"])
        self.assertEqual(ap_wind["qp_z"], expected_ap["qp_dan"])

        sanitized = ndc_generator.sanitize_assemblage_rtf(r"{\cellx480 test}")
        self.assertIn(r"\cellx9360", sanitized)

    def test_robot_worker_wind_source_of_truth_no_recomputation(self):
        import os
        from django.conf import settings
        from docx import Document
        from api.services import _populate_equipment_docx
        from api.stage_cache import extract_stage_cache_entry, merge_worker_result_with_cached

        # 1. Extraction helpers (standalone & composite)
        composite_res = {
            "wind": {
                "z_ref_m": 13.5,
                "z0": 0.005,
                "vb0": 26.0,
                "kr": 0.16,
                "cr": 1.26,
                "vm": 32.76,
                "iv": 0.13,
                "qp_dan_m2": 125.55,
                "fw_mast_dan_m": 17.45,
                "fw_4g_front_dan": 192.07,
                "fw_4g_lat_dan": 78.62,
                "fw_5g_front_dan": 98.27,
                "fw_5g_lat_dan": 45.02,
            },
            "fh_wind_params": {
                "region": 2,
                "terrain_type": "IV",
                "building_height_m": 10.0,
                "z_ref": 12.5,
                "v_b0": 24.0,
                "kr": 0.23,
                "cr": 0.58,
                "vm": 13.92,
                "iv": 0.40,
                "qp_dan": 45.06,
                "fw_mast": 5.15,
                "fw_front": 1.35,
                "fw_lat": 1.35,
                "pe_dan": 6.0,
                "mast_d_formula": 0.1143,
                "fw_fh": 1.35,
            },
            "fh": {
                "structure_params": {
                    "mast_section": "TRON 114x3.6",
                    "mast_d_m": 0.1143,
                    "mast_t_m": 0.0036,
                    "diam_mm": 114.3,
                    "thickness_mm": 3.6,
                    "hauteur_mat_m": 2.0,
                },
            },
            "fh_items": [
                {
                    "index": 1,
                    "name": "Antenne FH",
                    "qty": 1,
                    "diameter_mm": 300,
                    "weight_kg": 6.0,
                    "d_coef": 0.03,
                    "cf_fh": 1.0,
                    "fw_fh": 1.35,
                    "fw_fh_formula": "1 * 1 * 0.03 * 45.06 = 1.35 daN",
                }
            ],
            "fh_totals": {
                "qty_total": 1,
                "fw_fh": 1.35,
                "pe_dan": 6.0,
                "fw_fh_formula": "1.35 daN",
            },
        }
        standalone_res = {
            "wind_params": {
                "region": 2,
                "terrain_type": "IV",
                "building_height_m": 10.0,
                "z_ref": 12.0,
                "v_b0": 24.0,
                "kr": 0.23,
                "cr": 0.57,
                "vm": 13.68,
                "iv": 0.40,
                "qp_dan": 43.50,
                "fw_mast": 3.83,
                "fw_front": 2.10,
                "fw_lat": 1.90,
                "pe_dan": 12.0,
            },
            "fh_items": [
                {
                    "index": 1,
                    "name": "Antenne FH",
                    "qty": 1,
                    "diameter_mm": 600,
                    "weight_kg": 12.0,
                    "d_coef": 0.06,
                    "cf_fh": 1.0,
                    "fw_fh": 2.61,
                    "fw_fh_formula": "1 * 1 * 0.06 * 43.50 = 2.61 daN",
                }
            ],
            "structure_params": {
                "mast_section": "TRON 88x3.2",
                "mast_d_m": 0.0889,
                "mast_t_m": 0.0032,
                "diam_mm": 88.9,
                "thickness_mm": 3.2,
                "hauteur_mat_m": 2.0,
                "sans_plot": True,
            },
        }

        self.assertEqual(ndc_generator.get_antenna_wind(composite_res)["qp_dan_m2"], 125.55)
        self.assertEqual(ndc_generator.get_support_wind(composite_res, "fh")["qp_dan"], 45.06)
        self.assertEqual(ndc_generator.get_support_wind(standalone_res, "rru")["qp_dan"], 43.50)
        self.assertEqual(ndc_generator.get_support_structure_params(composite_res, "fh")["mast_d_m"], 0.1143)
        self.assertEqual(ndc_generator.get_support_structure_params(standalone_res, "fh")["mast_d_m"], 0.0889)

        # 2. Antenna resolution from result_data["wind"] must NOT recompute locally
        with patch("geodata.ndc.wind_ec1.calculate_wind_params", side_effect=AssertionError("must not recompute")):
            ant_w = ndc_generator.resolve_antenna_wind_params(
                composite_res,
                {"terrain_type": "IIIa", "building_height_m": 10.0},
                3.0,
                26,
            )
        self.assertEqual(ant_w["source"], "worker")
        self.assertEqual(ant_w["z_total"], 13.5)
        self.assertEqual(ant_w["vb_m_s"], 26.0)
        self.assertEqual(ant_w["kr_z"], 0.16)
        self.assertEqual(ant_w["cr_z"], 1.26)
        self.assertEqual(ant_w["vm_z"], 32.76)
        self.assertEqual(ant_w["iv_z"], 0.13)
        self.assertEqual(ant_w["qp_z"], 125.55)
        self.assertEqual(ant_w["fw_mast"], 17.45)
        self.assertEqual(ant_w["fw_4g_front"], 192.07)

        # 3. Antenna resolution from ndc_vars fallback must NOT recompute locally
        ndc_vars_only = {
            "ndc_vars": {
                "var_14": 14.0,
                "var_15": 24,
                "var_16": 0.22,
                "var_17": 0.85,
                "var_21": 20.4,
                "var_22": 0.24,
                "var_23": 59.1,
                "var_26": 8.21,
            }
        }
        with patch("geodata.ndc.wind_ec1.calculate_wind_params", side_effect=AssertionError("must not recompute")):
            ant_vars = ndc_generator.resolve_antenna_wind_params(
                ndc_vars_only,
                {"terrain_type": "IIIa", "building_height_m": 10.0},
                3.0,
                24,
            )
        self.assertEqual(ant_vars["source"], "worker_ndc_vars")
        self.assertEqual(ant_vars["z_total"], 14.0)
        self.assertEqual(ant_vars["qp_z"], 59.1)
        self.assertEqual(ant_vars["fw_mast"], 8.21)

        # 4. Legacy empty result_data falls back cleanly
        ant_legacy = ndc_generator.resolve_antenna_wind_params(
            {},
            {"terrain_type": "IIIa", "building_height_m": 10.0, "plot_height_m": 0.5},
            3.0,
            24,
        )
        self.assertEqual(ant_legacy["source"], "fallback")
        self.assertEqual(ant_legacy["z_total"], 13.5)
        self.assertGreater(ant_legacy["qp_z"], 0)

        # 5. Support wind resolution for all 4 modules must NOT recompute when worker wind_params exist
        with patch("geodata.ndc.wind_ec1.calculate_wind_params", side_effect=AssertionError("must not recompute")):
            for kind in ("rrh", "rru", "fh", "lovage"):
                wp = ndc_generator.get_support_wind(
                    {f"{kind}_wind_params": composite_res["fh_wind_params"]},
                    kind,
                )
                resolved = ndc_generator._resolve_support_wind_params(
                    wp, {}, {"terrain_type": "IV", "building_height_m": 10.0}, 24, 0.5, 2.0, sans_plot=False
                )
                self.assertEqual(resolved["kr_z"], 0.23)
                self.assertEqual(resolved["cr_z"], 0.58)
                self.assertEqual(resolved["vm_z"], 13.92)
                self.assertEqual(resolved["iv_z"], 0.40)
                self.assertEqual(resolved["qp_z"], 45.06)
                self.assertEqual(resolved["z_ref"], 12.5)
                self.assertEqual(resolved["vb_m_s"], 24.0)

        # 6. FH DOCX populator uses worker structure_params & fw_mast directly (114.3 and 88.9)
        fh_ctx_114 = ndc_generator.extract_fh_ndc_context(
            composite_res,
            input_data={"fh_equipment": {"enabled": True}},
        )
        self.assertEqual(fh_ctx_114["totals"]["fw_fh"], 1.35)
        doc_114 = Document(os.path.join(settings.BASE_DIR, "templates", "fh", "NDC FH.docx"))
        _populate_equipment_docx(doc_114, fh_ctx_114, kind="fh")
        p_txt_114 = "\n".join(p.text for p in doc_114.paragraphs)
        self.assertIn("45.06 daN/m²", p_txt_114)
        self.assertIn("0.1143 * 45.06 = 5.15 daN/ml", p_txt_114)
        self.assertIn("Ø114.3 mm, d’épaisseur 3.6 mm", p_txt_114)

        fh_ctx_88 = ndc_generator.extract_fh_ndc_context(
            standalone_res,
            input_data={"fh_equipment": {"enabled": True, "sans_plot": True}},
        )
        doc_88 = Document(os.path.join(settings.BASE_DIR, "templates", "fh", "NDC FH.docx"))
        _populate_equipment_docx(doc_88, fh_ctx_88, kind="fh")
        p_txt_88 = "\n".join(p.text for p in doc_88.paragraphs)
        self.assertIn("43.50 daN/m²", p_txt_88)
        self.assertIn("0.0889 * 43.50 = 3.83 daN/ml", p_txt_88)
        self.assertIn("Ø88.9 mm, d’épaisseur 3.2 mm", p_txt_88)

        # 7. Stage cache preserves standalone wind_params/structure_params and antenna wind
        ant_job = MagicMock(
            id=101,
            calculation_type="antenna",
            input_data={},
            result_data=composite_res,
        )
        for fld in ("screenshot", "verification_screenshot", "note_de_calcul", "note_mat", "note_plot", "assemblage_note", "reactions_file"):
            setattr(ant_job, fld, None)
        with patch("api.stage_cache._resolve_field_rel_path", side_effect=lambda j, f, fb, **kw: f"path/{f}"):
            ant_entry = extract_stage_cache_entry(ant_job, "antenna")
        self.assertIsNotNone(ant_entry)
        self.assertEqual(ant_entry["result_payload"]["wind"]["qp_dan_m2"], 125.55)

        fh_job = MagicMock(
            id=102,
            calculation_type="fh_sans_plot",
            input_data={"fh_equipment": {"enabled": True, "sans_plot": True}},
            result_data=standalone_res,
        )
        with patch("geodata.ndc.artifact_locator.find_job_equipment_rtf_paths", return_value={"note_mat": "/tmp/m.rtf"}), \
             patch("api.stage_cache._first_existing", side_effect=lambda cands: cands[0] or "/tmp/x"), \
             patch("api.stage_cache._rel_media_path", return_value="notes_fh/m.rtf"):
            fh_entry = extract_stage_cache_entry(fh_job, "fh")
        self.assertIsNotNone(fh_entry)
        self.assertEqual(fh_entry["result_payload"]["fh_wind_params"]["qp_dan"], 43.50)
        self.assertEqual(fh_entry["result_payload"]["fh"]["structure_params"]["mast_d_m"], 0.0889)

        merged = merge_worker_result_with_cached(
            ant_entry["result_payload"],
            {"fh_wind_params": fh_entry["result_payload"]["fh_wind_params"]},
            ["antenna"],
        )
        self.assertEqual(merged["wind"]["qp_dan_m2"], 125.55)
        self.assertEqual(merged["fh_wind_params"]["qp_dan"], 43.50)

    def test_fh_echelle_context_and_template_rendering(self):
        import os
        from django.conf import settings
        from django.template.loader import render_to_string
        from docx import Document
        from api.serializers import StructureFHSerializer
        from api.services import _populate_equipment_docx

        ser = StructureFHSerializer(data={})
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertEqual(ser.validated_data["mast_section"], "TRON 114x3.6")

        # Height < 2.0 m (default 1.70m) -> always sans echelle even if echelle="Echelle"
        ctx_no = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "structure": {"echelle": "Echelle Söll"},
                "fh_equipment": {"enabled": True, "echelle": "Echelle"},
            },
        )
        self.assertFalse(ctx_no["has_echelle"])
        self.assertEqual(ctx_no["mast_section"], "TRON 114x3.6")

        ctx_missing = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "structure": {"echelle": "Echelle Söll"},
                "fh_equipment": {"enabled": True},
            },
        )
        self.assertFalse(ctx_missing["has_echelle"])

        # Height >= 2.0 m -> always with echelle even if echelle="Pas d'échelle" or omitted
        ctx_yes = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "structure": {"echelle": "Pas d'échelle"},
                "fh_equipment": {"enabled": True, "hauteur_mat_m": 2.0, "echelle": "Pas d'échelle"},
            },
        )
        self.assertTrue(ctx_yes["has_echelle"])

        ctx_short = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "fh_equipment": {"enabled": True, "hauteur_mat_m": 1.99, "echelle": "Echelle"},
            },
        )
        self.assertFalse(ctx_short["is_sans_plot"])
        self.assertFalse(ctx_short["has_echelle"])

        ctx_legacy = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={"fh_equipment": {"enabled": True, "hauteur_mat_m": 2.5}},
        )
        self.assertTrue(ctx_legacy["has_echelle"])

        # Sans plot (dallettes) with height >= 2.0 m -> ALSO with echelle
        ctx_sans_plot = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={"fh_equipment": {"enabled": True, "sans_plot": True, "hauteur_mat_m": 2.5}},
        )
        self.assertTrue(ctx_sans_plot["is_sans_plot"])
        self.assertTrue(ctx_sans_plot["has_echelle"])

        ctx_without_plot = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={"fh_equipment": {"enabled": True, "with_plot": False, "hauteur_mat_m": 2.5, "echelle": "Pas d'échelle"}},
        )
        self.assertTrue(ctx_without_plot["is_sans_plot"])
        self.assertTrue(ctx_without_plot["has_echelle"])

        render_ctx = {
            "region": "Region 2",
            "terrain_type": "IIIa",
            "building_height": 15,
            "vb_m_s": 24,
            "cr_z": "0.85",
            "vm_z": "20.4",
            "iv_z": "0.21",
            "kr_z": "0.22",
            "qp_z": "50.5",
            "fh_items": ctx_yes["items"],
            "fh_totals": ctx_yes["totals"],
            "fh_qty_total": 1,
            "fh_has_echelle": True,
        }
        html_yes = render_to_string("ndc/fh.html", render_ctx)
        self.assertIn("<td>Echelle</td>", html_yes)
        self.assertIn("NF EN 795", html_yes)
        self.assertIn("F<sub>h</sub> = 2.2 kN", html_yes)
        self.assertIn("CH : Chute d’homme", html_yes)
        self.assertNotIn("Pas de point d’ancrage sur le mât", html_yes)

        html_no = render_to_string("ndc/fh.html", {**render_ctx, "fh_has_echelle": False})
        self.assertIn("Pas de point d’ancrage sur le mât", html_no)
        self.assertIn("Ø114.3 mm", html_no)
        self.assertIn("d’épaisseur 3.6 mm", html_no)
        self.assertIn("0.1143", html_no)
        self.assertIn("TRON 114x3.6", html_no)
        self.assertNotIn("<td>Echelle</td>", html_no)
        self.assertNotIn("NF EN 795", html_no)
        self.assertNotIn("CH : Chute d’homme", html_no)

        fh_doc = Document(os.path.join(settings.BASE_DIR, "templates", "fh", "NDC FH.docx"))
        _populate_equipment_docx(fh_doc, ctx_no, kind="fh")
        fh_p_txt = "\n".join(p.text for p in fh_doc.paragraphs)
        fh_t1_txt = "\n".join(c.text for r in fh_doc.tables[1].rows for c in r.cells)
        self.assertIn("Ø114.3 mm, d’épaisseur 3.6 mm", fh_p_txt)
        self.assertIn("0.1143", fh_p_txt)
        self.assertIn("114.3x3.6", fh_p_txt)
        self.assertIn("TRON 114x3.6", fh_t1_txt)

        # Secondary FH profile (TRON 88x3.2) remains supported when explicitly specified
        from utils.domain_constants import resolve_fh_mast_profile
        from utils.ndc_hash import compute_stage_hashes

        self.assertEqual(resolve_fh_mast_profile(None)["mast_section"], "TRON 114x3.6")
        self.assertEqual(resolve_fh_mast_profile("88.9*3.2")["mast_section"], "TRON 88x3.2")

        ctx_88 = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "fh_equipment": {"enabled": True},
                "structure_fh": {"mast_section": "TRON 88x3.2"},
            },
        )
        self.assertEqual(ctx_88["mast_section"], "TRON 88x3.2")

        fh_doc_88 = Document(os.path.join(settings.BASE_DIR, "templates", "fh", "NDC FH.docx"))
        _populate_equipment_docx(fh_doc_88, ctx_88, kind="fh")
        fh_p_88 = "\n".join(p.text for p in fh_doc_88.paragraphs)
        fh_t1_88 = "\n".join(c.text for r in fh_doc_88.tables[1].rows for c in r.cells)
        self.assertIn("Ø88.9 mm, d’épaisseur 3.2 mm", fh_p_88)
        self.assertIn("0.0889", fh_p_88)
        self.assertIn("88.9x3.2", fh_p_88)
        self.assertIn("TRON 88x3.2", fh_t1_88)

        base_hash_in = {
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 15.0},
            "fh_equipment": {"enabled": True, "diameter_mm": 600, "weight_kg": 15.0},
        }
        h_114 = compute_stage_hashes({**base_hash_in, "structure_fh": {"mast_section": "TRON 114x3.6"}}, "fh")["fh"]
        h_88 = compute_stage_hashes({**base_hash_in, "structure_fh": {"mast_section": "TRON 88x3.2"}}, "fh")["fh"]
        self.assertNotEqual(h_114, h_88)

        html_sans_plot = render_to_string("ndc/fh.html", {**render_ctx, "fh_has_echelle": True, "fh_sans_plot": True})
        self.assertIn("<td>Echelle</td>", html_sans_plot)
        self.assertIn("NF EN 795", html_sans_plot)
        self.assertIn("CH : Chute d’homme", html_sans_plot)
        self.assertNotIn("Pas de point d’ancrage sur le mât", html_sans_plot)

    def test_lovage_wind_context_hash_and_templates_avec_and_sans_plot(self):
        import os
        from django.conf import settings
        from django.template.loader import render_to_string
        from docx import Document
        from api.services import _populate_equipment_docx
        from utils.domain_constants import LOVAGE_CF_FRONT, LOVAGE_CF_LAT, resolve_sans_plot
        from utils.ndc_hash import compute_ndc_hash, detect_calculation_type

        self.assertEqual(LOVAGE_CF_FRONT, 1.47)
        self.assertEqual(LOVAGE_CF_LAT, 1.19)

        base_inp = {
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 15.0},
            "structure": {"hauteur_mat_m": 3.0},
            "antenna_4g": {"model": "ANT-1", "hauteur_mm": 2000, "largeur_mm": 400, "epaisseur_mm": 150, "poids_kg": 30},
            "boitier_lovage": {
                "enabled": True,
                "reference": "BLM-515709",
                "quantity": 2,
                "hauteur_mat_m": 1.5,
                "hauteur_mm": 300,
                "largeur_mm": 200,
                "epaisseur_mm": 100,
                "poids_kg": 2.5,
                "sans_plot": False,
                "with_plot": True,
            },
        }
        sp_inp = {
            **base_inp,
            "boitier_lovage": {**base_inp["boitier_lovage"], "sans_plot": True, "with_plot": False},
        }

        self.assertFalse(resolve_sans_plot(base_inp, kind="lovage"))
        self.assertTrue(resolve_sans_plot(sp_inp, kind="lovage"))
        self.assertTrue(resolve_sans_plot({"boitier_lovage": {"enabled": True, "ancrage": "dallettes"}}, kind="lovage"))
        self.assertFalse(resolve_sans_plot({"boitier_lovage": {"enabled": True, "ancrage": "beton"}}, kind="lovage"))
        self.assertFalse(resolve_sans_plot({"boitier_lovage": {"enabled": True, "ancrage": "metallique"}}, kind="lovage"))
        self.assertTrue(resolve_sans_plot({"fh_equipment": {"enabled": True, "ancrage": "dallettes"}}, kind="fh"))
        self.assertFalse(resolve_sans_plot({"fh_equipment": {"enabled": True, "ancrage": "beton"}}, kind="fh"))
        self.assertFalse(resolve_sans_plot({"fh_equipment": {"enabled": True, "ancrage": "metallique"}}, kind="fh"))
        self.assertTrue(resolve_sans_plot({"rrh_equipment": {"enabled": True, "ancrage": "dallettes"}}, kind="rrh"))
        self.assertFalse(resolve_sans_plot({"rrh_equipment": {"enabled": True, "ancrage": "beton"}}, kind="rrh"))
        self.assertTrue(resolve_sans_plot({"rru_equipment": {"enabled": True, "ancrage": "dallettes"}}, kind="rru"))
        self.assertFalse(resolve_sans_plot({"rru_equipment": {"enabled": True, "ancrage": "metallique"}}, kind="rru"))

        # Automatic height-only echelle rule across ALL auxiliary supports (FH, RRH, RRU, Lovage, TD, TGBT):
        # < 2.0 m => False, >= 2.0 m => True regardless of ancrage / sans_plot or manual echelle value
        from utils.domain_constants import resolve_support_has_echelle
        self.assertTrue(
            ndc_generator.extract_lovage_ndc_context(
                {}, input_data={"boitier_lovage": {"enabled": True, "ancrage": "metallique", "hauteur_mat_m": 2.0, "echelle": "Pas d'échelle"}}
            )["has_echelle"]
        )
        self.assertTrue(
            ndc_generator.extract_lovage_ndc_context(
                {}, input_data={"boitier_lovage": {"enabled": True, "ancrage": "dallettes", "hauteur_mat_m": 2.5}}
            )["has_echelle"]
        )
        self.assertFalse(
            ndc_generator.extract_lovage_ndc_context(
                {}, input_data={"boitier_lovage": {"enabled": True, "ancrage": "metallique", "hauteur_mat_m": 1.95, "echelle": "Echelle"}}
            )["has_echelle"]
        )
        self.assertTrue(
            ndc_generator.extract_rrh_ndc_context(
                {}, input_data={"rrh_equipment": {"enabled": True, "ancrage": "dallettes", "hauteur_mat_m": 2.2}}
            )["has_echelle"]
        )
        self.assertFalse(
            ndc_generator.extract_rru_ndc_context(
                {}, input_data={"rru_equipment": {"enabled": True, "ancrage": "metallique", "hauteur_mat_m": 1.5, "echelle": "Echelle"}}
            )["has_echelle"]
        )
        self.assertFalse(resolve_support_has_echelle({"td_equipment": {"enabled": True, "hauteur_mat_m": 1.7}}, kind="td"))
        self.assertTrue(resolve_support_has_echelle({"td_equipment": {"enabled": True, "ancrage": "dallettes", "hauteur_mat_m": 2.0}}, kind="td"))
        self.assertFalse(resolve_support_has_echelle({"tgbt_equipment": {"enabled": True, "hauteur_mat_m": 1.5}}, kind="tgbt"))
        self.assertTrue(resolve_support_has_echelle({"tgbt_equipment": {"enabled": True, "ancrage": "dallettes", "hauteur_mat_m": 2.1}}, kind="tgbt"))

        # Verify stage hash invariance to legacy/manual echelle strings when height is fixed
        from utils.ndc_hash import compute_stage_hashes
        h_lv_a = compute_stage_hashes({"environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 15.0}, "boitier_lovage": {"enabled": True, "hauteur_mat_m": 2.2, "echelle": "Pas d'échelle"}}, "lovage")["lovage"]
        h_lv_b = compute_stage_hashes({"environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 15.0}, "boitier_lovage": {"enabled": True, "hauteur_mat_m": 2.2, "echelle": "Echelle"}}, "lovage")["lovage"]
        self.assertEqual(h_lv_a, h_lv_b)

        # Render checks for RRH, RRU, Lovage, and TD templates with echelle
        tpl_common = {
            "mat_diam": "88",
            "mat_epaisseur": "3.2",
            "mat_section": "TRON 88x3.2",
            "plot_section": "TCAR 150x5",
            "plot_longueur_m": "0.5",
            "mat_longueur_m": "2.2",
            "qp_z": "100.00",
            "eq_qty": 1,
        }
        for tpl, key_prefix in (("ndc/rrh.html", "rrh"), ("ndc/rru.html", "rru"), ("ndc/lovage.html", "lovage"), ("ndc/td.html", "td")):
            html_ech = render_to_string(tpl, {**tpl_common, f"{key_prefix}_has_echelle": True, f"{key_prefix}_sans_plot": True, "is_sans_plot": True})
            self.assertIn("<td>Echelle</td>", html_ech)
            self.assertIn("NF EN 795", html_ech)
            html_no_ech = render_to_string(tpl, {**tpl_common, f"{key_prefix}_has_echelle": False, f"{key_prefix}_sans_plot": False, "is_sans_plot": False})
            self.assertNotIn("<td>Echelle</td>", html_no_ech)
            self.assertIn("Pas de point d’ancrage sur le mât", html_no_ech)
        self.assertEqual(detect_calculation_type(base_inp), "antenna_with_lovage")
        self.assertEqual(detect_calculation_type(sp_inp), "antenna_with_lovage_sans_plot")
        self.assertNotEqual(
            compute_ndc_hash(detect_calculation_type(base_inp), base_inp),
            compute_ndc_hash(detect_calculation_type(sp_inp), sp_inp),
        )

        # Wind force math: Cf,front=1.47, Cf,lat=1.19; H=300mm, W=200mm -> A_front=0.06m2; D=100mm -> A_lat=0.03m2; qty=2, qp=100
        ctx_avec = ndc_generator.extract_lovage_ndc_context({}, input_data=base_inp, qp_val=100.0)
        self.assertFalse(ctx_avec["is_sans_plot"])
        self.assertEqual(ctx_avec["qty_total"], 2)
        self.assertEqual(ctx_avec["items"][0]["cf_front"], 1.47)
        self.assertEqual(ctx_avec["items"][0]["cf_lat"], 1.19)
        self.assertAlmostEqual(ctx_avec["items"][0]["fw_front"], round(2 * 1.47 * 0.06 * 100.0, 2), places=2)
        self.assertAlmostEqual(ctx_avec["items"][0]["fw_lat"], round(2 * 1.19 * 0.03 * 100.0, 2), places=2)

        ctx_sans = ndc_generator.extract_lovage_ndc_context({}, input_data=sp_inp, qp_val=100.0)
        self.assertTrue(ctx_sans["is_sans_plot"])
        self.assertIsNone(ctx_sans["plot_section"])
        self.assertEqual(ctx_sans["hauteur_plot_m"], 0.0)

        # HTML template rendering: avec plot vs sans plot
        render_base = {
            "region": "Region 2",
            "terrain_type": "IIIa",
            "building_height": 15,
            "vb_m_s": 24,
            "cr_z": "0.96",
            "vm_z": "23.04",
            "iv_z": "0.23",
            "kr_z": "0.22",
            "qp_z": "100.00",
            "lovage_items": ctx_avec["items"],
            "lovage_totals": ctx_avec["totals"],
            "lovage_qty_total": 2,
            "lovage_mat_section": "TRON 88x3.2",
            "lovage_plot_section": "TCAR 150x5",
            "lovage_mat_longueur_m": 1.5,
            "lovage_plot_longueur_m": 0.5,
            "lovage_note_plot_images": ["/tmp/plot.png"],
            "lovage_assemblage_images": ["/tmp/ass.png"],
        }
        html_avec = render_to_string("ndc/lovage.html", {**render_base, "lovage_sans_plot": False, "is_sans_plot": False})
        self.assertIn("TCAR 150x5", html_avec)
        self.assertIn("Assemblage Mât / Plot métallique", html_avec)
        self.assertIn("1.47", html_avec)
        self.assertIn("1.19", html_avec)

        html_sans = render_to_string("ndc/lovage.html", {**render_base, "lovage_sans_plot": True, "is_sans_plot": True})
        self.assertNotIn("TCAR 150x5", html_sans)
        self.assertNotIn("Assemblage Mât / Plot métallique", html_sans)
        self.assertIn("TRON 88x3.2", html_sans)

        # DOCX template population for both actual lovage docx templates
        for fname, ctx in (
            ("boitier_lovage_avec_plot.docx", ctx_avec),
            ("boitier_lovage_sans_plot.docx", ctx_sans),
        ):
            tpl_path = os.path.join(settings.BASE_DIR, "templates", "lovage", fname)
            self.assertTrue(os.path.exists(tpl_path), f"Missing template {tpl_path}")
            doc = Document(tpl_path)
            _populate_equipment_docx(doc, ctx, kind="lovage")
            full_txt = "\n".join(p.text for p in doc.paragraphs)
            self.assertIn("supportant 2 boitiers de lovage", full_txt)
            self.assertIn("1.47", full_txt)
            self.assertIn("1.19", full_txt)

    def test_lovage_comounted_gps_and_mdea_all_variants(self):
        import os
        from django.conf import settings
        from django.template.loader import render_to_string
        from docx import Document
        from api.serializers import CalculationPayloadSerializer
        from api.services import _populate_equipment_docx, select_equipment_docx_template
        from utils.domain_constants import MDEA_CF_FRONT, MDEA_CF_LAT
        from utils.ndc_hash import compute_ndc_hash, detect_calculation_type

        self.assertEqual(MDEA_CF_FRONT, 1.46)
        self.assertEqual(MDEA_CF_LAT, 1.12)

        base_payload = {
            "operateur": "free",
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 15.0},
            "structure": {"hauteur_mat_m": 3.0},
            "boitier_lovage": {
                "enabled": True,
                "reference": "BLM-515709",
                "quantity": 2,
                "hauteur_mat_m": 1.5,
                "hauteur_mm": 300,
                "largeur_mm": 200,
                "epaisseur_mm": 100,
                "poids_kg": 2.5,
                "ancrage": "metallique",
                "sans_plot": False,
                "with_plot": True,
            },
        }
        gps_payload = {
            **base_payload,
            "gps": {"enabled": True, "quantity": 1, "marque": "NOKIA", "reference": "FYGC 474074A"},
        }
        gps_mdea_payload = {
            **gps_payload,
            "convertisseur_mdea": {
                "enabled": True,
                "quantite": 2,
                "dimensions": "338*295*140mm",
                "poids": 10,
                "cf_front": 1.46,
                "cf_lat": 1.12,
            },
        }
        gps_mdea_qty1_payload = {
            **gps_payload,
            "convertisseur_mdea": {"enabled": True, "quantite": 1, "dimensions": "338*295*140mm", "poids": 10},
        }

        # 1. Serializer preserves gps, convertisseur_mdea, and co-mount fields
        ser = CalculationPayloadSerializer(data=gps_mdea_payload)
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertTrue(ser.validated_data["gps"]["enabled"])
        self.assertEqual(ser.validated_data["gps"]["reference"], "FYGC 474074A")
        self.assertTrue(ser.validated_data["convertisseur_mdea"]["enabled"])
        self.assertEqual(ser.validated_data["convertisseur_mdea"]["quantite"], 2)

        # 2. Hash uniqueness across Lovage, Lovage+GPS, Lovage+GPS+MDEA (qty 1 vs qty 2)
        #    and unchanged hash for Lovage-only when gps/mdea disabled
        ct = detect_calculation_type(base_payload)
        h_base = compute_ndc_hash(ct, base_payload)
        h_base_disabled = compute_ndc_hash(
            ct,
            {
                **base_payload,
                "gps": {"enabled": False},
                "convertisseur_mdea": {"enabled": False},
            },
        )
        h_gps = compute_ndc_hash(ct, gps_payload)
        h_gps_mdea_1 = compute_ndc_hash(ct, gps_mdea_qty1_payload)
        h_gps_mdea_2 = compute_ndc_hash(ct, gps_mdea_payload)
        self.assertEqual(h_base, h_base_disabled)
        self.assertEqual(len({h_base, h_gps, h_gps_mdea_1, h_gps_mdea_2}), 4)

        # Composite multi-equipment hashes exceed 64 chars and must fit in CalculationJob hash fields
        from api.models import CalculationJob
        max_ndc_len = CalculationJob._meta.get_field("ndc_hash").max_length
        max_inp_len = CalculationJob._meta.get_field("input_hash").max_length
        for long_ct in (
            "antenna_with_rrh_sans_plot_and_fh_sans_plot",
            "antenna_with_rrh_sans_plot_and_fh_sans_plot_and_lovage_sans_plot",
        ):
            long_h = compute_ndc_hash(long_ct, gps_mdea_payload)
            self.assertGreater(len(long_h), 64)
            self.assertLessEqual(len(long_h), max_ndc_len)
            self.assertLessEqual(len(long_h), max_inp_len)

        # 3. Context extraction math: GPS catalog specs & negligible FEA, MDEA Cf_front=1.46 / Cf_lat=1.12
        ctx_gps = ndc_generator.extract_lovage_ndc_context({}, input_data=gps_payload, qp_val=100.0)
        self.assertTrue(ctx_gps["has_gps"])
        self.assertFalse(ctx_gps["has_mdea"])
        self.assertEqual(ctx_gps["lovage_variant"], "lovage_gps")
        self.assertEqual(ctx_gps["gps_item"]["dimensions_str"], "Ø95 x 72.5")
        self.assertAlmostEqual(ctx_gps["gps_item"]["weight_kg"], 0.154, places=3)
        self.assertEqual(ctx_gps["gps_item"]["weight_unit_kg"], "0.154")
        self.assertEqual(ctx_gps["gps_item"]["pe_dan"], 0.0)
        self.assertEqual(ctx_gps["gps_item"]["fw_front"], 0.0)

        ctx_ericsson_gps = ndc_generator.extract_lovage_ndc_context(
            {},
            input_data={**base_payload, "gps": {"enabled": True, "quantity": 1, "marque": "ERICSSON", "reference": "KRE 101 2395/2"}},
            qp_val=100.0,
        )
        self.assertEqual(ctx_ericsson_gps["gps_item"]["dimensions_str"], "Ø78")
        self.assertAlmostEqual(ctx_ericsson_gps["gps_item"]["weight_kg"], 0.225, places=3)
        self.assertEqual(ctx_ericsson_gps["gps_item"]["weight_unit_kg"], "0.225")
        self.assertEqual(ctx_ericsson_gps["gps_item"]["pe_dan"], 0.0)

        ctx_full = ndc_generator.extract_lovage_ndc_context({}, input_data=gps_mdea_payload, qp_val=100.0)
        self.assertTrue(ctx_full["has_gps"])
        self.assertTrue(ctx_full["has_mdea"])
        self.assertEqual(ctx_full["lovage_variant"], "lovage_gps_mdea")
        mdea = ctx_full["mdea_item"]
        self.assertEqual(mdea["qty"], 2)
        self.assertEqual(mdea["cf_front"], 1.46)
        self.assertEqual(mdea["cf_lat"], 1.12)
        self.assertAlmostEqual(mdea["a_front"], 0.0997, places=4)
        self.assertAlmostEqual(mdea["a_lat"], 0.0473, places=4)
        self.assertAlmostEqual(mdea["fw_front"], round(2 * 1.46 * 0.0997 * 100.0, 2), places=2)
        self.assertAlmostEqual(mdea["fw_lat"], round(2 * 1.12 * 0.0473 * 100.0, 2), places=2)
        self.assertAlmostEqual(mdea["pe_dan"], 20.0, places=2)
        # Combined totals: Lovage (5.0 daN) + MDEA (20.0 daN) = 25.0 daN
        self.assertAlmostEqual(ctx_full["totals"]["pe_dan"], 25.0, places=2)
        self.assertAlmostEqual(
            ctx_full["totals"]["fw_front"],
            round(ctx_full["items"][0]["fw_front"] + mdea["fw_front"], 2),
            places=2,
        )

        # 4. HTML template rendering for Lovage+GPS and Lovage+GPS+MDEA
        render_common = {
            "region": "Region 2",
            "terrain_type": "IIIa",
            "building_height": 15,
            "vb_m_s": 24,
            "cr_z": "0.96",
            "vm_z": "23.04",
            "iv_z": "0.23",
            "kr_z": "0.22",
            "qp_z": "100.00",
            "lovage_mat_section": "TRON 88x3.2",
            "lovage_plot_section": "TCAR 150x5",
            "lovage_mat_longueur_m": 1.5,
            "lovage_plot_longueur_m": 0.5,
            "lovage_sans_plot": False,
            "is_sans_plot": False,
        }
        html_gps = render_to_string(
            "ndc/lovage.html",
            {
                **render_common,
                "lovage_items": ctx_gps["items"],
                "lovage_totals": ctx_gps["totals"],
                "lovage_qty_total": ctx_gps["qty_total"],
                "lovage_has_gps": True,
                "lovage_has_mdea": False,
                "lovage_gps_item": ctx_gps["gps_item"],
                "lovage_mdea_item": None,
            },
        )
        self.assertIn("ÉTUDE BOÎTIERS DE LOVAGE + GPS", html_gps)
        self.assertIn("Antenne GPS (FYGC 474074A)", html_gps)
        self.assertNotIn("MDEA : F", html_gps)

        html_full = render_to_string(
            "ndc/lovage.html",
            {
                **render_common,
                "lovage_items": ctx_full["items"],
                "lovage_totals": ctx_full["totals"],
                "lovage_qty_total": ctx_full["qty_total"],
                "lovage_has_gps": True,
                "lovage_has_mdea": True,
                "lovage_gps_item": ctx_full["gps_item"],
                "lovage_mdea_item": ctx_full["mdea_item"],
            },
        )
        self.assertIn("ÉTUDE BOÎTIERS DE LOVAGE + GPS + MDEA", html_full)
        self.assertIn("Antenne GPS (FYGC 474074A)", html_full)
        self.assertIn("338 x 295 x 140", html_full)
        self.assertIn("MDEA : F<sub>w,Frontale</sub>", html_full)
        self.assertIn("MDEA : F<sub>w,Latéral</sub>", html_full)

        # 5. All 8 DOCX templates selection & population
        mdea_only_payload = {
            **base_payload,
            "convertisseur_mdea": {
                "enabled": True,
                "quantite": 2,
                "dimensions": "338*295*140mm",
                "poids": 10,
                "cf_front": 1.46,
                "cf_lat": 1.12,
            },
        }
        sp_mdea_only_payload = {
            **mdea_only_payload,
            "boitier_lovage": {**mdea_only_payload["boitier_lovage"], "sans_plot": True, "with_plot": False},
        }
        sp_gps_payload = {
            **gps_payload,
            "boitier_lovage": {**gps_payload["boitier_lovage"], "sans_plot": True, "with_plot": False},
        }
        sp_full_payload = {
            **gps_mdea_payload,
            "boitier_lovage": {**gps_mdea_payload["boitier_lovage"], "sans_plot": True, "with_plot": False},
        }
        ctx_mdea = ndc_generator.extract_lovage_ndc_context({}, input_data=mdea_only_payload, qp_val=100.0)
        self.assertEqual(ctx_mdea["lovage_variant"], "lovage_mdea")
        self.assertFalse(ctx_mdea["has_gps"])
        self.assertTrue(ctx_mdea["has_mdea"])
        ctx_mdea_sp = ndc_generator.extract_lovage_ndc_context({}, input_data=sp_mdea_only_payload, qp_val=100.0)
        ctx_gps_sp = ndc_generator.extract_lovage_ndc_context({}, input_data=sp_gps_payload, qp_val=100.0)
        ctx_full_sp = ndc_generator.extract_lovage_ndc_context({}, input_data=sp_full_payload, qp_val=100.0)

        cases = [
            (ctx_gps, "boitier_lovage+gps_avec_plot.docx", True, False),
            (ctx_gps_sp, "boitier_lovage+gps_sans_plot.docx", True, False),
            (ctx_mdea, "boitier_lovage+MDEA_avec_plot.docx", False, True),
            (ctx_mdea_sp, "boitier_lovage+MDEA_sans_plot.docx", False, True),
            (ctx_full, "boitier_lovage+GPS+MDEA_avec_plot.docx", True, True),
            (ctx_full_sp, "boitiers_lovage+GPS+MDEA_sans_plot.docx", True, True),
        ]
        for ctx_case, expected_fname, expect_gps, expect_mdea in cases:
            tpl_rel = select_equipment_docx_template("lovage", ctx_case)
            self.assertTrue(tpl_rel.endswith(expected_fname), f"Expected {expected_fname}, got {tpl_rel}")
            tpl_path = os.path.join(settings.BASE_DIR, tpl_rel)
            self.assertTrue(os.path.exists(tpl_path), f"Missing template {tpl_path}")
            doc = Document(tpl_path)
            _populate_equipment_docx(doc, ctx_case, kind="lovage")
            full_txt = "\n".join(p.text for p in doc.paragraphs)
            self.assertNotIn("XX", full_txt, f"Leftover XX in {expected_fname}")
            t0_txt = "\n".join(c.text for r in doc.tables[0].rows for c in r.cells)
            self.assertNotIn("XX", t0_txt, f"Leftover XX in Table 0 of {expected_fname}")
            t1_txt = "\n".join(c.text for r in doc.tables[1].rows for c in r.cells)
            self.assertIn("TRON 88x3.2", t1_txt)
            self.assertNotIn("TCAR 105x5", t1_txt)
            if not ctx_case["is_sans_plot"]:
                self.assertIn("TCAR 150x5", t1_txt)
            if expect_gps:
                self.assertIn("Antenne GPS (FYGC 474074A)", t0_txt)
                self.assertIn("une antenne GPS", full_txt)
            else:
                self.assertNotIn("Antenne GPS", t0_txt)
                self.assertNotIn("GPS", full_txt)
            if expect_mdea:
                self.assertIn("MDEA", t0_txt)
                self.assertIn("338 x 295 x 140", t0_txt)
                self.assertIn("2 convertisseurs MDEA", full_txt)
                self.assertIn("MDEA : Fw,Frontale = 2 * 1.46", full_txt)
                self.assertIn("MDEA : Fw,Latéral = 2 * 1.12", full_txt)
                # Ensure MDEA row État column is populated with Projet
                mdea_row = [r for r in doc.tables[0].rows if r.cells[0].text.strip() == "MDEA"][0]
                self.assertEqual(mdea_row.cells[4].text.strip(), "Projet")

    def test_per_stage_hashing_and_partial_cache_helpers(self):
        from api.stage_cache import (
            apply_cached_stages_to_job_kwargs,
            build_worker_input_for_missing_stages,
            merge_worker_result_with_cached,
        )
        from utils.ndc_hash import compute_stage_hashes

        base_composite = {
            "operateur": "free",
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 15.0, "plot_height_m": 0.0},
            "structure": {"hauteur_mat_m": 3.0, "structure_case": "cas1"},
            "antenna_4g": {"model": "ANT-4G", "hauteur_mm": 2000, "largeur_mm": 400, "epaisseur_mm": 150, "poids_kg": 30},
            "rrh_equipment": {"enabled": True, "hauteur_mat_m": 1.5, "sans_plot": True, "with_plot": False, "items": [{"reference": "AHHB 2600", "quantity": 1}]},
            "fh_equipment": {"enabled": True, "hauteur_mat_m": 1.7, "sans_plot": True, "with_plot": False, "items": [{"reference": "30cm Ø 300 mm", "diameter_mm": 300, "quantity": 1}]},
            "boitier_lovage": {"enabled": True, "reference": "BLM-515709", "quantity": 1, "hauteur_mat_m": 1.5, "sans_plot": False, "with_plot": True},
        }

        h1 = compute_stage_hashes(base_composite)
        self.assertEqual(set(h1.keys()), {"antenna", "rrh", "fh", "lovage"})
        for st, val in h1.items():
            self.assertLessEqual(len(val), 48, f"Stage hash {st}={val} exceeded 48 chars")
            self.assertTrue(val.startswith(f"stg_{st}_v1_"))

        # Changing FH only must keep antenna, rrh, and lovage hashes identical
        changed_fh = {
            **base_composite,
            "fh_equipment": {"enabled": True, "hauteur_mat_m": 1.7, "sans_plot": True, "with_plot": False, "items": [{"reference": "60cm Ø 600 mm", "diameter_mm": 600, "quantity": 1}]},
        }
        h2 = compute_stage_hashes(changed_fh)
        self.assertEqual(h1["antenna"], h2["antenna"])
        self.assertEqual(h1["rrh"], h2["rrh"])
        self.assertEqual(h1["lovage"], h2["lovage"])
        self.assertNotEqual(h1["fh"], h2["fh"])

        # Changing Lovage MDEA only must keep antenna, rrh, and fh hashes identical
        changed_lovage = {
            **base_composite,
            "convertisseur_mdea": {"enabled": True, "quantite": 1, "dimensions": "338*295*140mm", "poids": 10},
        }
        h3 = compute_stage_hashes(changed_lovage)
        self.assertEqual(h1["antenna"], h3["antenna"])
        self.assertEqual(h1["rrh"], h3["rrh"])
        self.assertEqual(h1["fh"], h3["fh"])
        self.assertNotEqual(h1["lovage"], h3["lovage"])

        # Changing wind region invalidates all active stages
        changed_wind = {
            **base_composite,
            "environment": {**base_composite["environment"], "region": 3},
        }
        h4 = compute_stage_hashes(changed_wind)
        for st in ("antenna", "rrh", "fh", "lovage"):
            self.assertNotEqual(h1[st], h4[st])

        # Partial cache pruning: keep ONLY fh when antenna + rrh + lovage are cached
        pruned_fh_only = build_worker_input_for_missing_stages(
            base_composite,
            cached_stages=["antenna", "lovage", "rrh"],
            missing_stages=["fh"],
        )
        self.assertEqual(pruned_fh_only["calculation_type"], "fh_sans_plot")
        self.assertTrue(pruned_fh_only["is_fh"])
        self.assertFalse(pruned_fh_only["rrh_equipment"]["enabled"])
        self.assertFalse(pruned_fh_only["boitier_lovage"]["enabled"])
        self.assertNotIn("antenna_4g", pruned_fh_only)

        # Partial cache pruning: keep ONLY antenna when rrh + fh + lovage are cached
        pruned_ant_only = build_worker_input_for_missing_stages(
            base_composite,
            cached_stages=["fh", "lovage", "rrh"],
            missing_stages=["antenna"],
        )
        self.assertEqual(pruned_ant_only["calculation_type"], "antenna")
        self.assertIn("antenna_4g", pruned_ant_only)
        self.assertFalse(pruned_ant_only["fh_equipment"]["enabled"])

        # Merging cached stages and worker output preserves both
        cached_entries = {
            "antenna": {
                "result_payload": {"wind_params": {"qp_dan": 80.0}},
                "artifact_paths": {"model_fields": {"screenshot": "screenshots/job_1_3d_view.jpg"}},
            },
            "rrh": {
                "result_payload": {"has_rrh": True, "rrh_items": [{"name": "AHHB 2600"}], "rrh_files": {"rrh_screenshot": "/tmp/rrh.jpg"}},
                "artifact_paths": {"model_fields": {"rrh_screenshot": "screenshots_rrh/job_1_rrh_3d_view.jpg"}},
            },
        }
        field_kwargs, pre_res = apply_cached_stages_to_job_kwargs(cached_entries)
        self.assertEqual(field_kwargs["screenshot"], "screenshots/job_1_3d_view.jpg")
        self.assertEqual(field_kwargs["rrh_screenshot"], "screenshots_rrh/job_1_rrh_3d_view.jpg")
        merged = merge_worker_result_with_cached(
            pre_res,
            {"has_fh": True, "fh_items": [{"name": "FH"}], "active_equipments": ["fh"], "fh_files": {"fh_screenshot": "/tmp/fh.jpg"}},
            cached_stages=["antenna", "rrh"],
        )
        self.assertTrue(merged["has_rrh"])
        self.assertTrue(merged["has_fh"])
        self.assertEqual(merged["wind_params"]["qp_dan"], 80.0)
        self.assertEqual(set(merged["active_equipments"]), {"rrh", "fh"})
        self.assertEqual(merged["rrh_files"]["rrh_screenshot"], "/tmp/rrh.jpg")
        self.assertEqual(merged["fh_files"]["fh_screenshot"], "/tmp/fh.jpg")

    def test_clear_calculation_cache_media_only_preserves_static_assets(self):
        import os
        import tempfile
        from django.test import override_settings

        with tempfile.TemporaryDirectory() as tmpdir:
            uploads_dir = os.path.join(tmpdir, "uploads")
            comb_dir = os.path.join(tmpdir, "combinaisons")
            cat_dir = os.path.join(tmpdir, "catalogue")
            scr_verif_dir = os.path.join(tmpdir, "screenshots", "verification")
            ndc_dir = os.path.join(tmpdir, "ndc")
            os.makedirs(uploads_dir)
            os.makedirs(comb_dir)
            os.makedirs(cat_dir)
            os.makedirs(scr_verif_dir)
            os.makedirs(ndc_dir)

            keep_paths = [
                os.path.join(uploads_dir, "logo_cometa.png"),
                os.path.join(comb_dir, "table.png"),
                os.path.join(cat_dir, "antennas.pdf"),
            ]
            delete_paths = [
                os.path.join(uploads_dir, "SITE_NDC_abc123.pdf"),
                os.path.join(uploads_dir, "NDC_12_def456.pdf"),
                os.path.join(uploads_dir, "LOVAGE_12_abc.pdf"),
                os.path.join(scr_verif_dir, "job_1_verification.jpg"),
                os.path.join(ndc_dir, "ndc_1.pdf"),
            ]
            for p in keep_paths + delete_paths:
                with open(p, "wb") as f:
                    f.write(b"test")

            out = StringIO()
            with override_settings(MEDIA_ROOT=tmpdir):
                call_command("clear_calculation_cache", media_only=True, yes=True, stdout=out)

            for p in keep_paths:
                self.assertTrue(os.path.exists(p), f"Static asset {p} should be preserved")
            for p in delete_paths:
                self.assertFalse(os.path.exists(p), f"Generated file {p} should be removed")

    def test_fh_designation_strips_dimensions_and_falls_back_to_fh(self):
        from django.template.loader import render_to_string
        from geodata.ndc.equipment_context import clean_fh_designation

        self.assertEqual(clean_fh_designation("BFZ 622 34/3S03H Ø 1200 mm"), "BFZ 622 34/3S03H")
        self.assertEqual(clean_fh_designation("BFZ 622 32/3S03H Ø 600 mm"), "BFZ 622 32/3S03H")
        self.assertEqual(clean_fh_designation("30cm Ø 300 mm"), "FH")
        self.assertEqual(clean_fh_designation("60cm Ø 600 mm"), "FH")
        self.assertEqual(clean_fh_designation("HUAWEI 30cm Ø 300 mm"), "FH")
        self.assertEqual(clean_fh_designation("COMMSCOPE 60cm Ø 600 mm"), "FH")
        self.assertEqual(clean_fh_designation("30cm"), "FH")
        self.assertEqual(clean_fh_designation(""), "FH")

        ctx_ref = ndc_generator.extract_fh_ndc_context(
            {"fh_items": [{"name": "BFZ 622 34/3S03H Ø 1200 mm", "qty": 1, "diameter_mm": 1200, "weight_kg": 32}]},
            input_data={"fh_equipment": {"enabled": True, "echelle": "Echelle"}},
        )
        self.assertEqual(ctx_ref["items"][0]["name"], "BFZ 622 34/3S03H")

        ctx_dim = ndc_generator.extract_fh_ndc_context(
            {"fh_items": [{"name": "30cm Ø 300 mm", "qty": 1, "diameter_mm": 300, "weight_kg": 6}]},
            input_data={"fh_equipment": {"enabled": True, "echelle": "Echelle"}},
        )
        self.assertEqual(ctx_dim["items"][0]["name"], "FH")

        html_ref = render_to_string("ndc/fh.html", {"fh_items": ctx_ref["items"], "fh_has_echelle": True})
        self.assertIn("<td>BFZ 622 34/3S03H</td>", html_ref)
        self.assertNotIn("BFZ 622 34/3S03H Ø 1200 mm", html_ref)

        html_dim = render_to_string("ndc/fh.html", {"fh_items": ctx_dim["items"], "fh_has_echelle": True})
        self.assertIn("<td>FH</td>", html_dim)
        self.assertNotIn("30cm", html_dim)

    def test_vector_tile_paris_transform_and_height_priority(self):
        parser = VectorTileParser()
        # Slippy tile containing Notre-Dame de Paris at zoom 15
        lon, lat = parser._tile_coord_to_wgs84(2048, 2048, z=15, x=16596, y=11273, extent=4096)
        self.assertAlmostEqual(lon, 2.3346, delta=0.02)
        self.assertAlmostEqual(lat, 48.8539, delta=0.02)

        height = parser._extract_building_height({"altitude_maximale_sol": 120.0, "hauteur": 18.5})
        self.assertEqual(height, 18.5)

    def test_postgis_sql_pushdown_aggregation_and_geopandas_fallback(self):
        sql_pcts = aggregate_code_areas_to_percentages({"111": 750.0, "211": 250.0})
        self.assertAlmostEqual(sql_pcts["urban"], 75.0, places=2)
        self.assertAlmostEqual(sql_pcts["agriculture"], 25.0, places=2)

        gdf = gpd.GeoDataFrame(
            {"Code_18": ["111", "211"]},
            geometry=[box(2.34, 48.84, 2.36, 48.86), box(2.36, 48.84, 2.38, 48.86)],
            crs="EPSG:4326",
        )
        ts = services.TerrainClassificationService.get_instance()
        with patch("geodata.terrain.service.query_spatial_extent_code_areas_sql", return_value=None):
            pcts = ts._compute_spatial_extent_percentages(2.35, 48.85, gdf, radius_km=2.0)
        self.assertGreater(pcts["urban"], 0)
        self.assertGreater(pcts["agriculture"], 0)

    def test_concurrent_bdtopo_tile_fetching(self):
        svc = BDTOPOService()
        svc.parser = MagicMock()
        svc.parser.get_tiles_for_area.return_value = [(15, 1, 1), (15, 1, 2), (15, 1, 3), (15, 1, 4)]

        worker_threads = set()

        def slow_fetch(z, x, y):
            worker_threads.add(threading.get_ident())
            time.sleep(0.04)
            return b"tile"

        svc.parser.fetch_tile.side_effect = slow_fetch
        svc.parser.parse_vector_tile.return_value = {"batiment": []}
        svc.parser.extract_building_features.return_value = [
            {"properties": {"centroid_lon": 2.35, "centroid_lat": 48.85, "area_sqm": 120.0, "height_m": 16.0}}
        ]

        t0 = time.time()
        with patch("geodata.terrain.bdtopo.cache") as mock_cache:
            mock_cache.get_many.return_value = {}
            bldgs = svc.get_building_footprints(2.35, 48.85, radius_km=1.0)
            elapsed = time.time() - t0
            self.assertEqual(len(bldgs), 4)
            self.assertGreaterEqual(len(worker_threads), 2)
            self.assertLess(elapsed, 0.15)
            mock_cache.get_many.assert_called_once()
            mock_cache.set_many.assert_called_once()

    def test_prime_meridian_zero_longitude_and_transition_bbox_guard(self):
        rf = RequestFactory()
        req = rf.post(
            "/api/geodata/terrain-classify-fast/",
            data=json.dumps({"latitude": 43.23, "longitude": 0.0}),
            content_type="application/json",
        )
        with patch.object(
            services.TerrainClassificationService, "get_terrain_type_at_coordinates", return_value="IIIa"
        ):
            resp = views.terrain_classification_fast_api(req)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(resp.content)["longitude"], 0.0)

        arf = APIRequestFactory()
        big_req = arf.get("/api/geodata/regions/transition_zones/?bbox=-5,41,9,51")
        big_resp = views.RegionGeoJSONViewSet.as_view({"get": "transition_zones"})(big_req)
        self.assertEqual(big_resp.status_code, 400)

    def test_sync_catalogue_dry_run_command(self):
        out = StringIO()
        call_command("sync_catalogue", "--dry-run", stdout=out)
        self.assertIn("[DRY-RUN] Validated", out.getvalue())


class GeodataDatabaseRegressionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="geo_admin",
            email="geo_admin@example.com",
            password="StrongAdminPassword123!",
        )
        self.admin_token = Token.objects.create(user=self.admin)

    def test_snapshot_preserves_structural_sections_and_restores_atomically(self):
        eq = AntennaEquipment.objects.create(
            name="Montage A1",
            region=2,
            building_height=Decimal("20.00"),
            mast_height=Decimal("4.00"),
            responsible_user=self.admin,
        )
        AntennaSpecification.objects.create(
            equipment=eq,
            antenna_type="4G",
            height_mm=Decimal("2100"),
            width_mm=Decimal("470"),
            thickness_mm=Decimal("210"),
            weight_dan=Decimal("45"),
        )
        doc = TerrainDocumentation.objects.create(
            equipment=eq,
            terrain_type="IIIa",
            document_urls="https://example.com/a1.pdf",
            document_types=[".pdf"],
        )
        TerrainLoadCalculation.objects.create(
            equipment=eq,
            terrain_type="IIIa",
            section_material="TRON 139x6.3",
            material_specification="S235",
            plot_metallique="TCAR 200x5",
            bras_de_deport="TCAR 50x5",
            mat_secondaire="TRON 76x5",
            documentation=doc,
        )

        snapshot = eq.create_snapshot()
        self.assertEqual(snapshot["calculations"][0]["plot_metallique"], "TCAR 200x5")
        self.assertEqual(snapshot["calculations"][0]["bras_de_deport"], "TCAR 50x5")
        self.assertEqual(snapshot["calculations"][0]["mat_secondaire"], "TRON 76x5")

        # Mutate and soft-delete, then restore
        eq.name = "Mutated Name"
        eq.is_deleted = True
        eq.save()
        eq.terrain_calculations.all().delete()

        eq.restore_snapshot(snapshot)
        eq.refresh_from_db()
        self.assertEqual(eq.name, "Montage A1")
        self.assertFalse(eq.is_deleted)
        restored_calc = eq.terrain_calculations.get(terrain_type="IIIa")
        self.assertEqual(restored_calc.plot_metallique, "TCAR 200x5")
        self.assertEqual(restored_calc.bras_de_deport, "TCAR 50x5")
        self.assertEqual(restored_calc.mat_secondaire, "TRON 76x5")
        self.assertEqual(restored_calc.documentation.document_urls, "https://example.com/a1.pdf")

    def test_equipment_list_avoids_n_plus_one_queries(self):
        for i in range(6):
            eq = AntennaEquipment.objects.create(
                name=f"Montage Test {i}",
                region=1,
                building_height=Decimal("15.00"),
                mast_height=Decimal("3.00"),
                responsible_user=self.admin,
            )
            AntennaSpecification.objects.create(
                equipment=eq,
                antenna_type="4G",
                height_mm=Decimal("2000"),
                width_mm=Decimal("450"),
                thickness_mm=Decimal("200"),
                weight_dan=Decimal("40"),
            )
            TerrainLoadCalculation.objects.create(
                equipment=eq,
                terrain_type="IIIa",
                section_material="TRON 139x6.3",
            )

        # Single annotated query (not 1 + 3N = 19 queries!)
        with self.assertNumQueries(1):
            resp = self.client.get("/api/geodata/antenna-equipment/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 6)
        self.assertEqual(resp.data[0]["specifications_count"], 1)
        self.assertEqual(resp.data[0]["terrain_calculations_count"], 1)

    def test_serializer_create_and_update_are_atomic(self):
        ser = AntennaEquipmentSerializer(
            data={
                "name": "Atomic Equipment",
                "region": 2,
                "building_height": "20.00",
                "mast_height": "4.00",
                "specifications": [
                    {
                        "antenna_type": "4G",
                        "height_mm": "2100",
                        "width_mm": "470",
                        "thickness_mm": "210",
                        "weight_dan": "45",
                    }
                ],
                "terrain_calculations": [
                    {
                        "terrain_type": "IIIb",
                        "section_material": "TRON 139x6.3",
                        "plot_metallique": "TCAR 200x5",
                    }
                ],
            }
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        eq = ser.save()
        self.assertEqual(eq.specifications.count(), 1)
        self.assertEqual(eq.terrain_calculations.count(), 1)

