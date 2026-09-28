import json
import os

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)

for rru in config.rru_references:
    if "operator" not in rru:
        rru["operator"] = "bouygues"

config.save()

with open("geodata/fixtures/catalogue_config.json", "r") as f:
    data = json.load(f)

for item in data:
    if item["model"] == "geodata.catalogueconfig" and item["pk"] == 1:
        item["fields"]["rru_references"] = config.rru_references
        break

with open("geodata/fixtures/catalogue_config.json", "w") as f:
    json.dump(data, f, indent=2)

print("Updated old RRUs to have operator='bouygues'")
