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
        wind = ndc_generator.calculate_wind_params("IIIa", 25.0, 24.0)
        self.assertGreater(wind["qp_dan"], 0)
        self.assertGreater(wind["vm"], 0)
        self.assertEqual(wind["z_used"], 25.0)

        sanitized = ndc_generator.sanitize_assemblage_rtf(r"{\cellx480 test}")
        self.assertIn(r"\cellx9360", sanitized)

    def test_fh_echelle_context_and_template_rendering(self):
        from django.template.loader import render_to_string

        ctx_no = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "structure": {"echelle": "Echelle Söll"},
                "fh_equipment": {"enabled": True, "echelle": "Pas d'échelle"},
            },
        )
        self.assertFalse(ctx_no["has_echelle"])

        ctx_missing = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "structure": {"echelle": "Echelle Söll"},
                "fh_equipment": {"enabled": True},
            },
        )
        self.assertFalse(ctx_missing["has_echelle"])

        ctx_yes = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={
                "structure": {"echelle": "Pas d'échelle"},
                "fh_equipment": {"enabled": True, "echelle": "Echelle"},
            },
        )
        self.assertTrue(ctx_yes["has_echelle"])

        ctx_legacy = ndc_generator.extract_fh_ndc_context(
            {},
            input_data={"fh_equipment": {"enabled": True, "echelle": "Echelle Söll"}},
        )
        self.assertTrue(ctx_legacy["has_echelle"])

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
        self.assertNotIn("<td>Echelle</td>", html_no)
        self.assertNotIn("NF EN 795", html_no)
        self.assertNotIn("CH : Chute d’homme", html_no)

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

