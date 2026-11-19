from django.core.management import call_command
from django.db import migrations


def ensure_cache_table(apps, schema_editor):
    db_alias = schema_editor.connection.alias
    if 'django_cache_table' not in schema_editor.connection.introspection.table_names():
        call_command('createcachetable', 'django_cache_table', database=db_alias, verbosity=0)


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('api', '0014_alter_calculationjob_calculation_type_and_more'),
    ]

    operations = [
        migrations.RunPython(ensure_cache_table, migrations.RunPython.noop),
    ]

