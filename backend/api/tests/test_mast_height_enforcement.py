import unittest
from rest_framework.exceptions import ValidationError

from utils.validators import (
    validate_hauteur_mat_m,
    validate_calculation_mast_heights,
    get_support_mast_height_m,
    MAST_HEIGHT_MIN_M,
    MAST_HEIGHT_MAX_M,
)
from utils.ndc_hash import compute_ndc_hash


class TestMastHeightEnforcement(unittest.TestCase):

    def test_validate_hauteur_mat_m_valid(self):
        self.assertEqual(validate_hauteur_mat_m(0.5, "test"), 0.5)
        self.assertEqual(validate_hauteur_mat_m("1.50", "test"), 1.5)
        self.assertEqual(validate_hauteur_mat_m(2.2, "test"), 2.2)
        self.assertEqual(validate_hauteur_mat_m(6.0, "test"), 6.0)

    def test_validate_hauteur_mat_m_invalid(self):
        invalid_values = [None, True, False, "", "   ", "abc", 0.49, 6.01, -1.0, float("nan"), float("inf")]
        for val in invalid_values:
            with self.subTest(val=val):
                with self.assertRaises(ValidationError):
                    validate_hauteur_mat_m(val, "test")

    def test_validate_calculation_mast_heights_composite(self):
        payload = {
            "antenna_4g": {"model": "Antenna 1"},
            "structure": {"hauteur_mat_m": 3.0},
            "rru_equipment": {
                "enabled": True,
                "hauteur_mat_m": "2.20",
                "items": [{"reference": "RRU3281", "quantity": 1}],
            },
            "rrh_equipment": {"enabled": False},
            "fh_equipment": {"enabled": False},
        }
        validate_calculation_mast_heights(payload)
        self.assertEqual(payload["rru_equipment"]["hauteur_mat_m"], 2.2)

    def test_validate_calculation_mast_heights_missing_equipment_height(self):
        payload = {
            "antenna_4g": {"model": "Antenna 1"},
            "structure": {"hauteur_mat_m": 3.0},
            "rrh_equipment": {
                "enabled": True,
                "items": [{"reference": "AHHB", "quantity": 1}],
            },
        }
        with self.assertRaises(ValidationError) as ctx:
            validate_calculation_mast_heights(payload)
        self.assertIn("rrh_equipment.hauteur_mat_m", str(ctx.exception))

    def test_validate_calculation_mast_heights_out_of_bounds(self):
        payload = {
            "antenna_4g": {"model": "Antenna 1"},
            "structure": {"hauteur_mat_m": 7.5},  # > 6.0
        }
        with self.assertRaises(ValidationError) as ctx:
            validate_calculation_mast_heights(payload)
        self.assertIn("structure.hauteur_mat_m", str(ctx.exception))

    def test_ndc_hash_different_equipment_heights(self):
        base_payload = {
            "antenna_4g": {"model": "Antenna 1"},
            "structure": {"hauteur_mat_m": 3.0},
            "environment": {"region": 2, "terrain_type": "II", "building_height_m": 15.0},
        }
        p1 = {**base_payload, "rru_equipment": {"enabled": True, "hauteur_mat_m": 1.5}}
        p2 = {**base_payload, "rru_equipment": {"enabled": True, "hauteur_mat_m": 2.5}}

        hash1 = compute_ndc_hash("antenna_with_rru", p1)
        hash2 = compute_ndc_hash("antenna_with_rru", p2)
        self.assertNotEqual(hash1, hash2)

    def test_get_support_mast_height_m(self):
        # Composite job: result_data.<kind>.structure_params.hauteur_mat_m
        composite_res = {
            "structure_params": {"hauteur_mat_m": 3.0},
            "rrh": {
                "structure_params": {"hauteur_mat_m": 1.80}
            }
        }
        self.assertEqual(get_support_mast_height_m(composite_res, "rrh"), 1.80)

        # Standalone job: result_data.structure_params.hauteur_mat_m
        standalone_res = {
            "structure_params": {"hauteur_mat_m": 2.20}
        }
        self.assertEqual(get_support_mast_height_m(standalone_res, "rru"), 2.20)

    def test_multi_equipment_detection_and_hashing(self):
        from utils.ndc_hash import detect_calculation_type
        from api.serializers import CalculationPayloadSerializer

        # 1. Base Antenna + RRH (avec plot) + FH (avec plot) -> antenna_with_rrh_and_fh
        payload_rrh_fh = {
            "environment": {"region": 2, "terrain_type": "IV", "building_height_m": 10.0},
            "structure": {"hauteur_mat_m": 3.0, "mast_section": "TRON 139x6.3"},
            "antenna_4g": {"model": "A1"},
            "rrh_equipment": {
                "enabled": True,
                "with_plot": True,
                "hauteur_mat_m": 1.50,
                "items": [{"reference": "NOKIA AHHB 2600", "quantity": 1}],
            },
            "rru_equipment": {"enabled": False, "items": []},
            "fh_equipment": {
                "enabled": True,
                "sans_plot": False,
                "hauteur_mat_m": 4.00,
                "items": [{"reference": "BFZ 622", "diameter_mm": 600, "weight_kg": 7.6, "quantity": 1}],
            },
        }
        ct1 = detect_calculation_type(payload_rrh_fh)
        self.assertEqual(ct1, "antenna_with_rrh_and_fh")

        # 2. Base Antenna + RRH (sans plot) + FH (avec plot) -> antenna_with_rrh_sans_plot_and_fh
        payload_rrh_sp_fh = {
            **payload_rrh_fh,
            "rrh_equipment": {
                **payload_rrh_fh["rrh_equipment"],
                "with_plot": False,
                "sans_plot": True,
            },
        }
        ct2 = detect_calculation_type(payload_rrh_sp_fh)
        self.assertEqual(ct2, "antenna_with_rrh_sans_plot_and_fh")

        # 3. Hash differentiates per-equipment plot mode and mast heights across all active blocks
        h1 = compute_ndc_hash(ct1, payload_rrh_fh)
        h2 = compute_ndc_hash(ct2, payload_rrh_sp_fh)
        self.assertNotEqual(h1, h2)

        # 4. Forbidden RRH + RRU coexistence rejected by serializer
        forbidden_payload = {
            **payload_rrh_fh,
            "rru_equipment": {
                "enabled": True,
                "hauteur_mat_m": 1.50,
                "items": [{"reference": "RRU3281", "quantity": 1}],
            },
        }
        ser = CalculationPayloadSerializer(data=forbidden_payload)
        self.assertFalse(ser.is_valid())
        self.assertIn("mutuellement exclusifs", str(ser.errors))


if __name__ == "__main__":
    unittest.main()
