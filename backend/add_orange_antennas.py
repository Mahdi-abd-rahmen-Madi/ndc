import json
import os

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)

raw_4g = [
    ("HUAWEI", "AQU4519R1v06", 2550, 429, 196, 34),
    ("HUAWEI", "A04220PA04v06", 2550, 429, 196, 37),
    ("COMMSCOPE", "RRZZ-65D-R4N43V1", 2770, 430, 200, 43),
    ("HUAWEI", "AQU4518R36v06", 2099, 449, 196, 37),
    ("HUAWEI", "AQU4519R05v06", 1383, 469, 206, 26),
    ("COMMSCOPE", "RRZZ-65A-R4N43", 1599, 430, 197, 26),
    ("HUAWEI", "AQU4520R01v06", 2550, 750, 230, 71.5),
    ("AMPHENOL", "5961470PG", 2690, 430, 180, 43),
    ("HUAWEI", "APE4518R25V07", 2770, 470, 200, 46),
    ("AMPHENOL", "5763470RG", 1990, 470, 210, 41.5),
    ("AMPHENOL", "5980400PG", 2683, 432, 175, 48),
    ("HUAWEI", "A06240PA04v06", 2550, 469, 229, 44),
    ("COMMSCOPE", "RRZZVV-65D-R6NV3", 2769, 430, 197, 46),
    ("HUAWEI", "A06240PA01v06", 2008, 469, 229, 39.8),
    ("COMMSCOPE", "RRZZVV-65B-R6NV3", 2100, 430, 197, 37.5),
    ("COMMSCOPE", "RRZZVV-65A-R6N43", 1599, 430, 197, 32),
    ("HUAWEI", "A06240PA03v06", 1509, 469, 229, 31.5),
    ("HUAWEI", "AOC4518R0V06", 2770, 470, 210, 53),
    ("COMMSCOPE", "EGRZV4-65D-R8N43", 2770, 430, 200, 56),
    ("AMPHENOL", "5798470G", 1950, 470, 210, 49),
    ("COMMSCOPE", "RRZZV4-65B-R8H4", 2100, 498, 197, 43),
    ("HUAWEI", "AMB4520R8V06", 1509, 399, 196, 22.5),
    ("BROADRADIO", "3UPX0605P", 1400, 1256, 210, 74),
    ("BROADRADIO", "3LPX0510P-2C", 1200, 448, 200, 32.5),
    ("BROADRADIO", "5LPX1106F", 761, 1076, 1360, 43.5),
    ("HUAWEI", "AMB4519R2V06", 2685, 359, 178, 35),
    ("HUAWEI", "AMB4519R9V06", 2550, 499, 206, 49),
    ("HUAWEI", "AMB4519R13V06", 2009, 499, 206, 40.5),
    ("HUAWEI", "AMB4519R18V06", 2009, 499, 206, 47)
]

raw_5g = [
    ("ERICSSON", "AIR6488 B43", 819, 400, 256, 45.5),
    ("ERICSSON", "AIR 3227 B42 AS", 568, 370, 225, 21.5),
    ("ERICSSON", "AIR 3227 B43", 568, 370, 225, 21.5),
    ("ERICSSON", "AIR 3227 B78T", 539, 370, 250, 24.5),
    ("ERICSSON", "AIR 3268 B42", 567, 370, 118, 12.5),
    ("ERICSSON", "AIR 3268 B78Y", 567, 370, 133, 15),
    ("ERICSSON", "AIR 3255 B78AA", 572, 408, 101, 11.8),
    ("ERICSSON", "AIR 3255 B78T", 572, 408, 101, 11.8),
    ("ERICSSON", "AIR 3255 B78Y", 572, 408, 101, 11.8),
    ("ERICSSON", "AIR 3255 B79A", 572, 408, 116, 13.5),
    ("ERICSSON", "AIR 3255 B79E", 572, 408, 116, 13.5)
]

existing_ids = {r.get("id") for r in config.real_world_references}

for vendor, model, h, w, t, weight in raw_4g:
    ref_id = f"4G_{vendor[:3]}_{model.replace(' ', '_')}"
    if ref_id not in existing_ids:
        config.real_world_references.append({
            "id": ref_id,
            "name": f"{vendor} {model}",
            "ant4g": {
                "model": model,
                "width": w,
                "height": h,
                "weight": weight,
                "thickness": t
            },
            "ant5g": {
                "model": "",
                "width": 0,
                "height": 0,
                "weight": 0,
                "thickness": 0
            },
            "operator": "orange",
            "montageId": "Custom"
        })
        existing_ids.add(ref_id)

for vendor, model, h, w, t, weight in raw_5g:
    ref_id = f"5G_{vendor[:3]}_{model.replace(' ', '_')}"
    if ref_id not in existing_ids:
        config.real_world_references.append({
            "id": ref_id,
            "name": f"{vendor} {model}",
            "ant4g": {
                "model": "",
                "width": 0,
                "height": 0,
                "weight": 0,
                "thickness": 0
            },
            "ant5g": {
                "model": model,
                "width": w,
                "height": h,
                "weight": weight,
                "thickness": t
            },
            "operator": "orange",
            "montageId": "Custom"
        })
        existing_ids.add(ref_id)

config.save()

with open("geodata/fixtures/catalogue_config.json", "r") as f:
    data = json.load(f)

for item in data:
    if item["model"] == "geodata.catalogueconfig" and item["pk"] == 1:
        item["fields"]["real_world_references"] = config.real_world_references
        break

with open("geodata/fixtures/catalogue_config.json", "w") as f:
    json.dump(data, f, indent=2)

print("Added ORANGE antennas to database and fixture.")
