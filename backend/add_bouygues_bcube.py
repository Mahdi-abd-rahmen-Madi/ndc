import json
import os
import sys

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)
atelier_refs = config.atelier_energie_references or []

# B-cube énergie equipments for Bouygues (ACTIA & TLTI)
bcube_specs = [
    {
        "id": "bcube_actia_ae_eltek_9kw",
        "name": "AE ELTEK 9kw",
        "operator": "bouygues",
        "supplier": "ACTIA"
    },
    {
        "id": "bcube_actia_ae_huawei_15kw",
        "name": "AE HUAWEI 15kw",
        "operator": "bouygues",
        "supplier": "ACTIA"
    },
    {
        "id": "bcube_tlti_ae_huawei_9kw",
        "name": "AE HUAWEI 9kw",
        "operator": "bouygues",
        "supplier": "TLTI"
    },
    {
        "id": "bcube_tlti_ae_huawei_15kw",
        "name": "AE HUAWEI 15kw",
        "operator": "bouygues",
        "supplier": "TLTI"
    }
]

# Keep non-bouygues atelier items (e.g. Free FPRB/FPBC) and replace bouygues items
updated_atelier = [item for item in atelier_refs if item.get("operator") != "bouygues"]
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
