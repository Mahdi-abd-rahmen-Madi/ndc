"""
Synchronize the modular JSON equipment catalogue (`geodata/fixtures/catalogue/*.json`)
into the `CatalogueConfig` DB singleton and combined Django fixtures.
Replaces the retired one-off seeding scripts.
"""
from django.core.management.base import BaseCommand

from geodata.catalogue_loader import (
    clear_catalogue_cache,
    get_catalogue_files_info,
    load_catalogue_dict,
    sync_catalogue_to_db,
)


class Command(BaseCommand):
    help = "Sync modular catalogue JSON files into CatalogueConfig DB singleton and combined fixtures."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and report catalogue file counts without writing to DB or fixture files.",
        )
        parser.add_argument(
            "--no-fixtures",
            action="store_true",
            help="Only update the CatalogueConfig database row; skip regenerating combined fixture JSON files.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        save_fixtures = not options["no_fixtures"]

        clear_catalogue_cache()
        files_info = get_catalogue_files_info()
        catalogue = load_catalogue_dict()

        self.stdout.write(self.style.NOTICE("Catalogue source files:"))
        total_items = 0
        for info in files_info:
            total_items += info["item_count"]
            self.stdout.write(
                f"  - {info['filename']:22s} ({info['category']}): {info['item_count']} items ({info['file_size_kb']} KB)"
            )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"[DRY-RUN] Validated {len(files_info)} catalogue files ({total_items} total entries). No changes written."
                )
            )
            return

        sync_catalogue_to_db(save_fixtures=save_fixtures)
        self.stdout.write(
            self.style.SUCCESS(
                f"Synced {len(files_info)} catalogue files ({total_items} entries) to CatalogueConfig DB"
                + (" and combined fixtures." if save_fixtures else " (fixtures skipped).")
            )
        )

