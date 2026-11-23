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


if __name__ == "__main__":
    unittest.main()
