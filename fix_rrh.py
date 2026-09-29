import json

path = 'backend/geodata/fixtures/catalogue_config.json'
with open(path, 'r') as f:
    data = json.load(f)

for item in data:
    if 'fields' in item and 'rrh_references' in item['fields']:
        for rrh in item['fields']['rrh_references']:
            if rrh.get('reference', '').startswith('RRH '):
                rrh['reference'] = rrh['reference'].replace('RRH ', '', 1)

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
