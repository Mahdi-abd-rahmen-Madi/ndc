import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0017_alter_calculationjob_calculation_type_multi_equipment'),
    ]

    operations = [
        migrations.CreateModel(
            name='PdfGenerationTask',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('RUNNING', 'Running'), ('COMPLETED', 'Completed'), ('FAILED', 'Failed')], default='PENDING', max_length=20, verbose_name='Status')),
                ('pdf_url', models.CharField(blank=True, default='', max_length=512, verbose_name='PDF URL')),
                ('error_message', models.TextField(blank=True, default='', verbose_name='Error Message')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated At')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pdf_generation_tasks', to=settings.AUTH_USER_MODEL, verbose_name='User')),
            ],
            options={
                'verbose_name': 'PDF Generation Task',
                'verbose_name_plural': 'PDF Generation Tasks',
                'ordering': ['-created_at'],
            },
        ),
    ]
