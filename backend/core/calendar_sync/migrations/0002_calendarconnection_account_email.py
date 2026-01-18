# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('calendar_sync', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='calendarconnection',
            name='account_email',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
