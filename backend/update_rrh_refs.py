from geodata.models import CatalogueConfig
config = CatalogueConfig.objects.get(pk=1)

if not config.rrh_references:
    config.rrh_references = [
        { "id": "rrh_hua_ahpmdb", "vendor": "HUAWEI", "reference": "RRH AHPMDB" },
        { "id": "rrh_hua_ahhb", "vendor": "HUAWEI", "reference": "RRH AHHB" },
        { "id": "rrh_hua_ahegc", "vendor": "HUAWEI", "reference": "RRH AHEGC" },
        { "id": "rrh_hua_ahda", "vendor": "HUAWEI", "reference": "RRH AHDA" },
        { "id": "rrh_hua_ahpd", "vendor": "HUAWEI", "reference": "RRH AHPD" }
    ]
    config.save()
    print("Catalogue config updated with RRH references.")
else:
    print("RRH references already exist.")
