import os
from django.conf import settings
from django.core.management.base import BaseCommand


ARTIFACT_DIRS = (
    "assemblages",
    "charges_fh",
    "charges_lovage",
    "charges_rrh",
    "charges_rru",
    "ndc",
    "notes_de_calcul",
    "notes_fh",
    "notes_lovage",
    "notes_rrh",
    "notes_rru",
    "reactions",
    "reactions_fh",
    "reactions_lovage",
    "reactions_rrh",
    "reactions_rru",
    "screenshots",
    "screenshots_fh",
    "screenshots_lovage",
    "screenshots_rrh",
    "screenshots_rru",
    "verif_fh",
    "verif_lovage",
    "verif_rrh",
    "verif_rru",
)

GENERATED_UPLOAD_PDF_PREFIXES = (
    "NDC_",
    "SITE_NDC_",
    "FH_",
    "RRH_",
    "RRU_",
    "LOVAGE_",
    "TD_",
)


class Command(BaseCommand):
    help = (
        "Clear all calculation caches, jobs, generated site NDC PDFs, and Robot "
        "artifacts while preserving static assets (logo_cometa.png, combinaisons, "
        "catalogue, client_logos)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show counts of records and files that would be removed without deleting anything.",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm destructive deletion.",
        )
        parser.add_argument(
            "--keep-media",
            action="store_true",
            help="Clear database rows only and keep files on disk.",
        )
        parser.add_argument(
            "--media-only",
            action="store_true",
            help="Clear generated media files on disk only without touching the database.",
        )
        parser.add_argument(
            "--reset-quota",
            action="store_true",
            help="Also reset ClientSubscription.used_quota to 0.",
        )

    def _collect_media_targets(self):
        media_root = settings.MEDIA_ROOT
        targets = []

        for subdir in ARTIFACT_DIRS:
            dir_path = os.path.join(media_root, subdir)
            if not os.path.isdir(dir_path):
                continue
            for root, _dirs, files in os.walk(dir_path):
                for fname in files:
                    targets.append(os.path.join(root, fname))

        uploads_dir = os.path.join(media_root, "uploads")
        if os.path.isdir(uploads_dir):
            for fname in os.listdir(uploads_dir):
                fpath = os.path.join(uploads_dir, fname)
                if (
                    os.path.isfile(fpath)
                    and fname.lower().endswith(".pdf")
                    and fname.startswith(GENERATED_UPLOAD_PDF_PREFIXES)
                ):
                    targets.append(fpath)

        return targets

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        confirmed = options["yes"]
        keep_media = options["keep_media"]
        media_only = options["media_only"]
        reset_quota = options["reset_quota"]

        if not dry_run and not confirmed:
            self.stderr.write(
                self.style.WARNING(
                    "Refusing to delete without --yes (or pass --dry-run to preview)."
                )
            )
            return

        if not media_only:
            from api.models import (
                CalculationJob,
                CalculationStageCache,
                ClientSubscription,
                GeneratedSiteNdc,
                PdfGenerationTask,
            )

            stage_count = CalculationStageCache.objects.count()
            job_count = CalculationJob.objects.count()
            site_ndc_count = GeneratedSiteNdc.objects.count()
            pdf_task_count = PdfGenerationTask.objects.count()

            self.stdout.write(
                f"DB rows: CalculationStageCache={stage_count}, CalculationJob={job_count}, "
                f"GeneratedSiteNdc={site_ndc_count}, PdfGenerationTask={pdf_task_count}"
            )
            if not dry_run:
                CalculationStageCache.objects.all().delete()
                CalculationJob.objects.all().delete()
                GeneratedSiteNdc.objects.all().delete()
                PdfGenerationTask.objects.all().delete()
                if reset_quota:
                    updated = ClientSubscription.objects.update(used_quota=0)
                    self.stdout.write(f"Reset used_quota=0 on {updated} subscriptions.")

        if not keep_media:
            files_to_remove = self._collect_media_targets()
            self.stdout.write(f"Generated media files targeted: {len(files_to_remove)}")
            if not dry_run:
                removed = 0
                for fpath in files_to_remove:
                    try:
                        os.remove(fpath)
                        removed += 1
                    except OSError as exc:
                        self.stderr.write(f"Warning: could not remove {fpath}: {exc}")
                self.stdout.write(self.style.SUCCESS(f"Removed {removed} generated media files."))
        else:
            self.stdout.write("Skipped media cleanup (--keep-media).")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run complete. No changes made."))
        else:
            self.stdout.write(self.style.SUCCESS("Calculation cache cleanup complete."))
