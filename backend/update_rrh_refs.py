import os
import json
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from geodata.models import CatalogueConfig
config = CatalogueConfig.objects.get(pk=1)

nokia_models = [
    ("ahpd", "AHPD"),
    ("arpa", "ARPA"),
    ("ahda", "AHDA"),
    ("arda", "ARDA"),
    ("aera", "AERA"),
    ("arga", "ARGA"),
    ("ahhb", "AHHB"),
    ("ahpmdb", "AHPMDB"),
    ("ahpmd", "AHPMD"),
    ("ahegc", "AHEGC"),
    ("ahegha", "AHEGHA"),
    ("3500_azqj", "3500 AZQJ"),
]

rrh_refs = []
for op in ["free", "orange"]:
    for key, model in nokia_models:
        rrh_refs.append({
            "id": f"rrh_nok_{op}_{key}",
            "vendor": "NOKIA",
            "operator": op,
            "reference": model
        })

config.rrh_references = rrh_refs
config.save()
print(f"Database CatalogueConfig updated with {len(rrh_refs)} RRH Nokia references (Free and Orange).")

# Update catalogue_config.json fixture
fixture_path = "geodata/fixtures/catalogue_config.json"
if os.path.exists(fixture_path):
    with open(fixture_path, "r") as f:
        data = json.load(f)

    for item in data:
        if item.get("model") == "geodata.catalogueconfig" and item.get("pk") == 1:
            item["fields"]["rrh_references"] = rrh_refs
            break

    with open(fixture_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {fixture_path}")

# Update all_geodata.json fixture if present
all_fixture_path = "geodata/fixtures/all_geodata.json"
if os.path.exists(all_fixture_path):
    with open(all_fixture_path, "r") as f:
        data = json.load(f)

    for item in data:
        if item.get("model") == "geodata.catalogueconfig" and item.get("pk") == 1:
            item["fields"]["rrh_references"] = rrh_refs
            break

    with open(all_fixture_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {all_fixture_path}")
