from geodata.models import CatalogueConfig
config = CatalogueConfig.objects.get(pk=1)

if not config.td_references:
    config.td_references = [
        { "id": "td_mono_free", "vendor": "FREE", "name": "TD mono", "reference": "68236", "weight": 60, "dimensions": "1055x850x350mm" },
        { "id": "td_tri_free", "vendor": "FREE", "name": "TD triphasé", "reference": "68237", "weight": 60, "dimensions": "1055x850x350mm" }
    ]

if not config.fh_references:
    config.fh_references = [
        { "id": "fh_ericsson_60", "vendor": "ERICSSON", "name": "BFZ 622 32/3S03H", "diameter": 600, "weight": 7.6, "reference": "BFZ 622 32/3S03H" },
        { "id": "fh_ericsson_90", "vendor": "ERICSSON", "name": "BFZ 622 33/3S03H", "diameter": 900, "weight": 17, "reference": "BFZ 622 33/3S03H" },
        { "id": "fh_ericsson_120", "vendor": "ERICSSON", "name": "BFZ 622 34/3S03H", "diameter": 1200, "weight": 32, "reference": "BFZ 622 34/3S03H" }
    ]
else:
    # Add new Huawei and Commscope ones if they don't exist
    existing_fhs = [fh["id"] for fh in config.fh_references]
    new_fhs = [
        { "id": "fh_huawei_30", "vendor": "HUAWEI", "name": "30cm", "diameter": 300, "weight": 6, "reference": "30cm" },
        { "id": "fh_huawei_60", "vendor": "HUAWEI", "name": "60cm", "diameter": 600, "weight": 14.5, "reference": "60cm" },
        { "id": "fh_commscope_30", "vendor": "COMMSCOPE", "name": "30cm", "diameter": 300, "weight": 6, "reference": "30cm" },
        { "id": "fh_commscope_60", "vendor": "COMMSCOPE", "name": "60cm", "diameter": 600, "weight": 14.5, "reference": "60cm" }
    ]
    for nfh in new_fhs:
        if nfh["id"] not in existing_fhs:
            config.fh_references.append(nfh)

if not config.rru_references:
    config.rru_references = []

existing_rrus = [rru["id"] for rru in config.rru_references]
new_rrus = [
    { "id": "rru_eri_2460", "vendor": "ERICSSON", "reference": "Radio 2460" },
    { "id": "rru_eri_4499", "vendor": "ERICSSON", "reference": "Radio 4499" },
    { "id": "rru_eri_4415", "vendor": "ERICSSON", "reference": "Radio 4415" },
    { "id": "rru_eri_4486", "vendor": "ERICSSON", "reference": "Radio 4486" },
    { "id": "rru_eri_4020", "vendor": "ERICSSON", "reference": "Radio 4020" },
    { "id": "rru_eri_4490", "vendor": "ERICSSON", "reference": "Radio 4490" },
    { "id": "rru_eri_4471", "vendor": "ERICSSON", "reference": "Radio 4471" },
    { "id": "rru_eri_4485", "vendor": "ERICSSON", "reference": "Radio 4485" },
    { "id": "rru_eri_2262", "vendor": "ERICSSON", "reference": "Radio 2262" },
    { "id": "rru_eri_2212", "vendor": "ERICSSON", "reference": "Radio 2212" },
    { "id": "rru_hua_5512t", "vendor": "HUAWEI", "reference": "RRU5512t" },
    { "id": "rru_hua_5916s", "vendor": "HUAWEI", "reference": "RRU5916s" },
    { "id": "rru_hua_5502n", "vendor": "HUAWEI", "reference": "RRU5502N" },
    { "id": "rru_hua_5827", "vendor": "HUAWEI", "reference": "RRU5827" },
    { "id": "rru_hua_5304w", "vendor": "HUAWEI", "reference": "RRU5304w" },
    { "id": "rru_hua_5519et", "vendor": "HUAWEI", "reference": "RRU5519et" },
    { "id": "rru_hua_5301", "vendor": "HUAWEI", "reference": "RRU5301" },
    { "id": "rru_hua_5309", "vendor": "HUAWEI", "reference": "RRU5309" },
    { "id": "rru_hua_5909", "vendor": "HUAWEI", "reference": "RRU5909" },
    { "id": "rru_hua_5505", "vendor": "HUAWEI", "reference": "RRU5505" },
    { "id": "rru_hua_5516", "vendor": "HUAWEI", "reference": "RRU5516" },
    { "id": "rru_hua_3281", "vendor": "HUAWEI", "reference": "RRU3281" }
]
for nrru in new_rrus:
    if nrru["id"] not in existing_rrus:
        config.rru_references.append(nrru)

config.save()
print("Catalogue config updated with RRU and TD references.")
