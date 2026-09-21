import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from geodata.models import CatalogueConfig
config = CatalogueConfig.objects.get(pk=1)

config.rrh_references = [
    { "id": "rrh_nok_ahpd", "vendor": "NOKIA", "reference": "RRH AHPD" },
    { "id": "rrh_nok_arpa", "vendor": "NOKIA", "reference": "RRH ARPA" },
    { "id": "rrh_nok_ahda", "vendor": "NOKIA", "reference": "RRH AHDA" },
    { "id": "rrh_nok_arda", "vendor": "NOKIA", "reference": "RRH ARDA" },
    { "id": "rrh_nok_aera", "vendor": "NOKIA", "reference": "RRH AERA" },
    { "id": "rrh_nok_arga", "vendor": "NOKIA", "reference": "RRH ARGA" },
    { "id": "rrh_nok_ahhb", "vendor": "NOKIA", "reference": "RRH AHHB" },
    { "id": "rrh_nok_ahpmdb", "vendor": "NOKIA", "reference": "RRH AHPMDB" },
    { "id": "rrh_nok_ahpmd", "vendor": "NOKIA", "reference": "RRH AHPMD" },
    { "id": "rrh_nok_ahegc", "vendor": "NOKIA", "reference": "RRH AHEGC" },
    { "id": "rrh_nok_ahegha", "vendor": "NOKIA", "reference": "RRH AHEGHA" },
    { "id": "rrh_nok_3500_azqj", "vendor": "NOKIA", "reference": "RRH 3500 AZQJ" }
]
config.save()
print("Catalogue config updated with full list of RRH Nokia references.")
