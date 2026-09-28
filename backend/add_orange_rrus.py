import json
import os

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)

orange_rrus = [
    "Radio 2217 B28",
    "Radio 2217 B20",
    "Radio 2212 B8",
    "Radio 2262 B20B28",
    "Radio 2260 B8B20",
    "Radio 4486 B8B20B28",
    "Radio 2217 B3",
    "Radio 2212 B3",
    "Radio 4415 B3",
    "Radio 2271 B1",
    "Radio 2260 B1B3",
    "Radio 4490 B1B3",
    "Radio 2271 B7",
    "Radio 4415 B7",
    "Radio 4471 B7",
    "Radio 4485 B1B3B7",
    "Radio 4823 B1B3B7"
]

existing_rru_ids = [r["id"] for r in config.rru_references]

for model in orange_rrus:
    rru_id = f"rru_eri_{model.replace(' ', '_').lower()}"
    if rru_id not in existing_rru_ids:
        config.rru_references.append({
            "id": rru_id,
            "vendor": "ERICSSON",
            "reference": model,
            "operator": "orange"
        })

config.save()

# Now update the JSON fixture
with open("geodata/fixtures/catalogue_config.json", "r") as f:
    data = json.load(f)

for item in data:
    if item["model"] == "geodata.catalogueconfig" and item["pk"] == 1:
        item["fields"]["rru_references"] = config.rru_references
        break

with open("geodata/fixtures/catalogue_config.json", "w") as f:
    json.dump(data, f, indent=2)

print("Added ORANGE RRUs to database and fixture.")
