import json
import os
import sys

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)
atelier_refs = config.atelier_energie_references or []

# BCube equipments for Bouygues
bcube_specs = [
    # ELTEK - ACTIA
    {
        "id": "bcube_eltek_actia_6kw_mono",
        "name": "BCube 6kW mono(TD+AE)",
        "reference": "BCube 6kW mono(TD+AE)",
        "vendor": "ELTEK",
        "supplier": "ACTIA",
        "operator": "bouygues",
        "power": "6kW",
        "phase": "mono",
        "height": 1000,
        "width": 600,
        "thickness": 600,
        "weight": 50.0,
        "dimensions": "1000x600x600mm"
    },
    {
        "id": "bcube_eltek_actia_6kw_tri",
        "name": "BCube 6kW tri (TD+AE)",
        "reference": "BCube 6kW tri (TD+AE)",
        "vendor": "ELTEK",
        "supplier": "ACTIA",
        "operator": "bouygues",
        "power": "6kW",
        "phase": "tri",
        "height": 1000,
        "width": 600,
        "thickness": 600,
        "weight": 50.0,
        "dimensions": "1000x600x600mm"
    },
    # ELTEK - TLTI
    {
        "id": "bcube_eltek_tlti_9kw_mono",
        "name": "BCube NRJ 9kW mono(TD+AE)",
        "reference": "BCube NRJ 9kW mono(TD+AE)",
        "vendor": "ELTEK",
        "supplier": "TLTI",
        "operator": "bouygues",
        "power": "9kW",
        "phase": "mono",
        "height": 830,
        "width": 700,
        "thickness": 730,
        "weight": 50.0,
        "dimensions": "830x700x730mm"
    },
    {
        "id": "bcube_eltek_tlti_9kw_tri",
        "name": "BCube NRJ 9kW tri (TD+AE)",
        "reference": "BCube NRJ 9kW tri (TD+AE)",
        "vendor": "ELTEK",
        "supplier": "TLTI",
        "operator": "bouygues",
        "power": "9kW",
        "phase": "tri",
        "height": 830,
        "width": 700,
        "thickness": 730,
        "weight": 50.0,
        "dimensions": "830x700x730mm"
    },
    # HUAWEI - TLTI
    {
        "id": "bcube_huawei_tlti_9kw_mono",
        "name": "BCube NRJ 9kW mono (TD+AE)",
        "reference": "BCube NRJ 9kW mono (TD+AE)",
        "vendor": "HUAWEI",
        "supplier": "TLTI",
        "operator": "bouygues",
        "power": "9kW",
        "phase": "mono",
        "height": 830,
        "width": 700,
        "thickness": 730,
        "weight": 50.0,
        "dimensions": "830x700x730mm"
    },
    {
        "id": "bcube_huawei_tlti_9kw_tri",
        "name": "BCube NRJ 9kW tri (TD+AE)",
        "reference": "BCube NRJ 9kW tri (TD+AE)",
        "vendor": "HUAWEI",
        "supplier": "TLTI",
        "operator": "bouygues",
        "power": "9kW",
        "phase": "tri",
        "height": 830,
        "width": 700,
        "thickness": 730,
        "weight": 50.0,
        "dimensions": "830x700x730mm"
    },
    {
        "id": "bcube_huawei_tlti_15kw_mono",
        "name": "BCube NJR15kW mono (TD+AE)",
        "reference": "BCube NJR15kW mono (TD+AE)",
        "vendor": "HUAWEI",
        "supplier": "TLTI",
        "operator": "bouygues",
        "power": "15kW",
        "phase": "mono",
        "height": 830,
        "width": 700,
        "thickness": 730,
        "weight": 50.0,
        "dimensions": "830x700x730mm"
    },
    {
        "id": "bcube_huawei_tlti_15kw_tri",
        "name": "BCube NJR15kW tri (TD+AE)",
        "reference": "BCube NJR15kW tri (TD+AE)",
        "vendor": "HUAWEI",
        "supplier": "TLTI",
        "operator": "bouygues",
        "power": "15kW",
        "phase": "tri",
        "height": 830,
        "width": 700,
        "thickness": 730,
        "weight": 50.0,
        "dimensions": "830x700x730mm"
    },
    # HUAWEI - ACTIA
    {
        "id": "bcube_huawei_actia_15kw_mono",
        "name": "ACTIA BCUBE 15KW MONO (TD+AE)",
        "reference": "ACTIA BCUBE 15KW MONO (TD+AE)",
        "vendor": "HUAWEI",
        "supplier": "ACTIA",
        "operator": "bouygues",
        "power": "15kW",
        "phase": "mono",
        "height": 1000,
        "width": 600,
        "thickness": 600,
        "weight": 50.0,
        "dimensions": "1000x600x600mm"
    },
    {
        "id": "bcube_huawei_actia_15kw_tri",
        "name": "ACTIA BCUBE 15KW TRI (TD+AE)",
        "reference": "ACTIA BCUBE 15KW TRI (TD+AE)",
        "vendor": "HUAWEI",
        "supplier": "ACTIA",
        "operator": "bouygues",
        "power": "15kW",
        "phase": "tri",
        "height": 1000,
        "width": 600,
        "thickness": 600,
        "weight": 50.0,
        "dimensions": "1000x600x600mm"
    }
]

# Keep non-bouygues atelier items (e.g. Free FPRB/FPBC) and replace/add bouygues items
existing_ids = {item["id"] for item in bcube_specs}
updated_atelier = [item for item in atelier_refs if item.get("id") not in existing_ids and item.get("operator") != "bouygues"]
updated_atelier.extend(bcube_specs)

config.atelier_energie_references = updated_atelier
config.save()
print(f"Updated CatalogueConfig.atelier_energie_references: {len(updated_atelier)} total items.")

# Update fixtures
fixtures = ["geodata/fixtures/catalogue_config.json", "geodata/fixtures/all_geodata.json"]
for fixture_path in fixtures:
    if os.path.exists(fixture_path):
        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for item in data:
            if item.get("model") == "geodata.catalogueconfig":
                item["fields"]["atelier_energie_references"] = config.atelier_energie_references

        with open(fixture_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Synchronized fixture: {fixture_path}")
