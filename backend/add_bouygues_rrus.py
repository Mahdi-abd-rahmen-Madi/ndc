import json
import os
import sys

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
application = get_wsgi_application()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)
rru_references = config.rru_references or []

# Requested Bouygues RRU specifications
# Format: (vendor, reference, dimensions, weight, preferred_id)
bouygues_specs = [
    # ERICSSON
    ("ERICSSON", "Radio 4486", "444x384x143mm", 27.1, "rru_eri_4486"),
    ("ERICSSON", "Radio 4020", "417x391x157mm", 23.5, "rru_eri_4020"),
    ("ERICSSON", "Radio 4490", "442x384x124mm", 23.0, "rru_eri_4490"),
    ("ERICSSON", "Radio 4415", "420x342x169mm", 19.0, "rru_eri_4415"),
    ("ERICSSON", "Radio 4471", "354x261x130mm", 13.0, "rru_eri_4471"),
    ("ERICSSON", "Radio 4485", "452x384x138.3mm", 23.6, "rru_eri_4485"),
    ("ERICSSON", "Radio 2460", "553x398x190mm", 38.0, "rru_eri_2460"),
    ("ERICSSON", "Radio 4499", "550x400x145mm", 32.0, "rru_eri_4499"),
    # HUAWEI
    ("HUAWEI", "RRU5512t", "480x356x140mm", 25.0, "rru_hua_5512t"),
    ("HUAWEI", "RRU5916s", "400x300x150mm", 18.0, "rru_hua_5916s"),
    ("HUAWEI", "RRU5502N", "480x356x140mm", 25.0, "rru_hua_5502n"),
    ("HUAWEI", "RRU5827", "480x356x140mm", 23.0, "rru_hua_5827"),
    ("HUAWEI", "RRU5304w", "400x300x150mm", 22.0, "rru_hua_5304w"),
    ("HUAWEI", "RRU5519et", "480x356x140mm", 25.0, "rru_hua_5519et"),
    ("HUAWEI", "RRU5301", "400x300x100mm", 15.0, "rru_hua_5301"),
    ("HUAWEI", "RRU5909", "400x300x100mm", 15.0, "rru_hua_5909"),
    ("HUAWEI", "RRU5309", "400x300x100mm", 15.0, "rru_hua_5309"),
    ("HUAWEI", "RRU5505N", "400x300x150mm", 18.0, "rru_hua_5505n"),
    ("HUAWEI", "RRU5516", "480x356x170mm", 28.0, "rru_hua_5516"),
    ("HUAWEI", "RRU3281", "400x300x150mm", 18.0, "rru_hua_3281"),
]

print("=== Analyzing existing RRU references in Database ===")
existing_bouygues = {}
for r in rru_references:
    op = (r.get('operator') or 'bouygues').lower()
    if op == 'bouygues':
        existing_bouygues[r.get('reference', '').lower()] = r

updated_count = 0
added_count = 0

for vendor, ref, dims, weight, pref_id in bouygues_specs:
    ref_key = ref.lower()
    # Check if exists (also check RRU5505 -> RRU5505N)
    found = None
    if ref_key in existing_bouygues:
        found = existing_bouygues[ref_key]
    elif ref_key == 'rru5505n' and 'rru5505' in existing_bouygues:
        found = existing_bouygues['rru5505']
        found['reference'] = 'RRU5505N'
        found['id'] = pref_id

    if found:
        print(f"UPDATING existing Bouygues RRU '{found.get('reference')}' (id={found.get('id')}): dimensions='{dims}', weight={weight}")
        found['dimensions'] = dims
        found['weight'] = weight
        found['operator'] = 'bouygues'
        found['vendor'] = vendor
        updated_count += 1
    else:
        print(f"ADDING new Bouygues RRU '{ref}' (id={pref_id}): dimensions='{dims}', weight={weight}")
        new_entry = {
            "id": pref_id,
            "vendor": vendor,
            "operator": "bouygues",
            "reference": ref,
            "dimensions": dims,
            "weight": weight
        }
        rru_references.append(new_entry)
        existing_bouygues[ref_key] = new_entry
        added_count += 1

config.rru_references = rru_references
config.save()
print(f"\nSaved DB: {updated_count} updated, {added_count} added. Total RRUs: {len(rru_references)}")

# Synchronize fixtures
fixtures = ["geodata/fixtures/catalogue_config.json", "geodata/fixtures/all_geodata.json"]
for fixture_path in fixtures:
    if os.path.exists(fixture_path):
        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for item in data:
            if item.get("model") == "geodata.catalogueconfig":
                item["fields"]["rru_references"] = config.rru_references

        with open(fixture_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Synchronized fixture: {fixture_path}")

print("Done.")
