import os
import json
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from geodata.models import CatalogueConfig

baie_refs = [
    # 1. Radio & Trans
    {
        "id": "orange_baie_radio_rb6120_outdoor",
        "name": "Baie radio RB6120 OUTDOOR",
        "reference": "RB6120 OUTDOOR",
        "category": "radio_trans",
        "category_label": "Radio & Trans",
        "dimensions": "1540x700x700mm",
        "height": 1540,
        "width": 700,
        "depth": 700,
        "weight": 380,
        "operator": "orange"
    },
    {
        "id": "orange_baie_radio_rb6140",
        "name": "Baie radio RB6140",
        "reference": "RB6140",
        "category": "radio_trans",
        "category_label": "Radio & Trans",
        "dimensions": "1650x650x700mm",
        "height": 1650,
        "width": 650,
        "depth": 700,
        "weight": 190,
        "operator": "orange"
    },
    {
        "id": "orange_baie_radio_rbs6330",
        "name": "Baie radio RBS6330",
        "reference": "RBS6330",
        "category": "radio_trans",
        "category_label": "Radio & Trans",
        "dimensions": "650x900x425mm",
        "height": 650,
        "width": 900,
        "depth": 425,
        "weight": 50,
        "operator": "orange"
    },
    {
        "id": "orange_baie_tlti_fg2_radio_trans",
        "name": "Baie TLTI FG2 RADIO /TRANS",
        "reference": "FG2 RADIO /TRANS",
        "category": "radio_trans",
        "category_label": "Radio & Trans",
        "dimensions": "1650x855x750mm",
        "height": 1650,
        "width": 855,
        "depth": 750,
        "weight": 93,
        "operator": "orange"
    },
    # 2. Énergie (-48V)
    {
        "id": "orange_baie_energie_walkyrie_t3_18kw",
        "name": "Baie énergie Outdoor WALKYRIE T3 18kw",
        "reference": "WALKYRIE T3 18kw",
        "category": "energie",
        "category_label": "Énergie (-48V)",
        "dimensions": "1550x700x770mm",
        "height": 1550,
        "width": 700,
        "depth": 770,
        "weight": 211,
        "operator": "orange"
    },
    {
        "id": "orange_baie_energie_t3_10_8kw",
        "name": "Baie énergie Outdoor T3 10.8kw",
        "reference": "T3 10.8kw",
        "category": "energie",
        "category_label": "Énergie (-48V)",
        "dimensions": "1200x700x770mm",
        "height": 1200,
        "width": 700,
        "depth": 770,
        "weight": 150,
        "operator": "orange"
    },
    {
        "id": "orange_baie_energie_gbox",
        "name": "Baie énergie GBOX",
        "reference": "GBOX",
        "category": "energie",
        "category_label": "Énergie (-48V)",
        "dimensions": "",
        "height": None,
        "width": None,
        "depth": None,
        "weight": None,
        "operator": "orange"
    },
    {
        "id": "orange_baie_tlti_fg2_tgbt_48v",
        "name": "Baie TLTI FG2 TGBT /48V",
        "reference": "FG2 TGBT /48V",
        "category": "energie",
        "category_label": "Énergie (-48V)",
        "dimensions": "1650x855x750mm",
        "height": 1650,
        "width": 855,
        "depth": 750,
        "weight": None,
        "operator": "orange"
    },
    # 3. Distribution (AC)
    {
        "id": "orange_baie_seifel",
        "name": "Baie SEIFEL",
        "reference": "SEIFEL",
        "category": "distribution",
        "category_label": "Distribution (AC)",
        "dimensions": "1485x885x540mm",
        "height": 1485,
        "width": 885,
        "depth": 540,
        "weight": 86,
        "operator": "orange"
    },
    {
        "id": "orange_baie_tlti_fg2_tgbt_trans",
        "name": "Baie TLTI FG2 TGBT /TRANS",
        "reference": "FG2 TGBT /TRANS",
        "category": "distribution",
        "category_label": "Distribution (AC)",
        "dimensions": "1650x855x750mm",
        "height": 1650,
        "width": 855,
        "depth": 750,
        "weight": 95,
        "operator": "orange"
    },
    # 4. Raccordement
    {
        "id": "orange_coffret_outdoor_trans_tlti_2015",
        "name": "Coffret Outdoor Trans TLTI 2015",
        "reference": "Trans TLTI 2015",
        "category": "raccordement",
        "category_label": "Raccordement",
        "dimensions": "1600x900x620mm",
        "height": 1600,
        "width": 900,
        "depth": 620,
        "weight": 65,
        "operator": "orange"
    }
]

config = CatalogueConfig.objects.get(pk=1)
config.baie_references = baie_refs
config.save()
print(f"Database CatalogueConfig updated with {len(baie_refs)} Orange Baie references.")

fixture_path = os.path.join(os.path.dirname(__file__), "geodata/fixtures/catalogue_config.json")
if os.path.exists(fixture_path):
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for item in data:
        if item.get("model") == "geodata.catalogueconfig" and item.get("pk") == 1:
            item["fields"]["baie_references"] = baie_refs
            break

    with open(fixture_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Fixture geodata/fixtures/catalogue_config.json successfully updated.")
