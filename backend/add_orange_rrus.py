import json
import os

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)

raw_rrus = [
    ("Radio 2217 B28", "351x298x138mm", 12.9),
    ("Radio 2217 B20", "351x298x138mm", 12.9),
    ("Radio 2212 B8", "420x342x149mm", 18.2),
    ("Radio 2262 B20B28", "447x398x143mm", 21.0),
    ("Radio 2260 B8B20", "447x398x143mm", 21.0),
    ("Radio 4486 B8B20B28", "522x397x149mm", 27.1),
    ("Radio 2217 B3", "351x298x138mm", 12.6),
    ("Radio 2212 B3", "420x342x149mm", 18.0),
    ("Radio 4415 B3", "420x342x131mm", 17.5),
    ("Radio 2271 B1", "409x269x110mm", 9.4),
    ("Radio 2260 B1B3", "447x398x137mm", 19.5),
    ("Radio 4490 B1B3", "522x397x130mm", 23.0),
    ("Radio 2271 B7", "409x269x110mm", 10.0),
    ("Radio 4415 B7", "420x342x150mm", 19.0),
    ("Radio 4471 B7", "419x269x136mm", 13.0),
    ("Radio 4485 B1B3B7", "533x398x145mm", 24.0),
    ("Radio 4823 B1B3B7", "572x398x168mm", 31.4),
    ("Radio 2460", "553x398x190mm", 37.0),
    ("Radio 4480", "553x398x151mm", 38.0)
]

rrus = config.rru_references or []
existing_orange = {r.get('reference'): r for r in rrus if r.get('operator') == 'orange'}

for model, dims, weight in raw_rrus:
    if model in existing_orange:
        existing_orange[model]['dimensions'] = dims
        existing_orange[model]['weight'] = weight
    else:
        slug = model.lower().replace(' ', '_')
        rrus.append({
            "id": f"rru_eri_orange_{slug}",
            "vendor": "ERICSSON",
            "reference": model,
            "operator": "orange",
            "dimensions": dims,
            "weight": weight
        })

config.rru_references = rrus
config.save()

# Update fixtures
for fixture_file in ["geodata/fixtures/catalogue_config.json", "geodata/fixtures/all_geodata.json"]:
    if os.path.exists(fixture_file):
        with open(fixture_file, "r") as f:
            data = json.load(f)

        for item in data:
            if item.get("model") == "geodata.catalogueconfig":
                item["fields"]["rru_references"] = config.rru_references

        with open(fixture_file, "w") as f:
            json.dump(data, f, indent=2)

print("Synchronized all ORANGE Ericsson RRUs with database and fixtures.")
