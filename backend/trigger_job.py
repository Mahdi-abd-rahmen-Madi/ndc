import requests
import json

API_URL = "http://localhost:8001/api/api/calculations/"

payload = {
    "site": {
        "type": "nouveau",
        "ancrage": "metallique",
        "address": "123 Test Rue, Paris",
        "latitude": 46.8545,
        "longitude": 2.3522
    },
    "environment": {
        "region": 1,
        "terrain_type": "A",
        "building_height_m": 15.0,
        "dalle_thickness_m": 0.2,
        "plot_height_m": 1.5
    },
    "structure": {
        "mast_height_m": 5.5,
        "montage_id": "montage_standard_01",
        "is_custom_montage": False,
        "mat_principal": "HEB160",
        "plot_metallique": "None",
        "bras_de_deport": "None",
        "mat_secondaire": "None"
    },
    "antenna_4g": {
        "model": "Antenna_4G_Type_A",
        "height_mm": 2000.0,
        "width_mm": 400.0,
        "thickness_mm": 150.0,
        "weight_dan": 45.0
    },
    "antenna_5g": {
        "model": "Antenna_5G_Type_B",
        "height_mm": 1500.0,
        "width_mm": 300.0,
        "thickness_mm": 120.0,
        "weight_dan": 35.0
    },
    "fh_equipment": {
        "enabled": False,
        "diameter_mm": 0.0
    },
    "rrh_equipment": {
        "enabled": False,
        "reference": "None"
    },
    "rru_equipment": {
        "enabled": False,
        "reference": "None"
    },
    "catalogue_match": {
        "found": False,
        "equipment_id": None,
        "material_specification": "S235"
    }
}

def trigger():
    print(f"Sending test job payload to {API_URL}...")
    try:
        response = requests.post(API_URL, json=payload)
        print(f"Status Code: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error triggering job: {e}")

if __name__ == "__main__":
    trigger()
