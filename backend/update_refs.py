from geodata.models import CatalogueConfig
config = CatalogueConfig.objects.get(pk=1)

if not config.td_references:
    config.td_references = [
        { "id": "td_mono_free", "vendor": "FREE", "name": "TD mono", "reference": "68236", "weight": 60, "dimensions": "1055x850x350mm" },
        { "id": "td_tri_free", "vendor": "FREE", "name": "TD triphasé", "reference": "68237", "weight": 60, "dimensions": "1055x850x350mm" }
    ]

if not config.rru_references:
    config.rru_references = [
        { "id": "rru_eri_2460", "vendor": "ERICSSON", "reference": "Radio 2460" },
        { "id": "rru_eri_4499", "vendor": "ERICSSON", "reference": "Radio 4499" },
        { "id": "rru_eri_4415", "vendor": "ERICSSON", "reference": "Radio 4415" },
        { "id": "rru_eri_4486", "vendor": "ERICSSON", "reference": "Radio 4486" },
        { "id": "rru_eri_4020", "vendor": "ERICSSON", "reference": "Radio 4020" },
        { "id": "rru_eri_4490", "vendor": "ERICSSON", "reference": "Radio 4490" },
        { "id": "rru_eri_4471", "vendor": "ERICSSON", "reference": "Radio 4471" },
        { "id": "rru_hua_5512t", "vendor": "HUAWEI", "reference": "RRU5512t" },
        { "id": "rru_hua_5916s", "vendor": "HUAWEI", "reference": "RRU5916s" },
        { "id": "rru_hua_5502n", "vendor": "HUAWEI", "reference": "RRU5502N" },
        { "id": "rru_hua_5827", "vendor": "HUAWEI", "reference": "RRU5827" },
        { "id": "rru_hua_5304w", "vendor": "HUAWEI", "reference": "RRU5304w" },
        { "id": "rru_hua_5519et", "vendor": "HUAWEI", "reference": "RRU5519et" },
        { "id": "rru_hua_5301", "vendor": "HUAWEI", "reference": "RRU5301" }
    ]

config.save()
print("Catalogue config updated with RRU and TD references.")
