import os
import time
from django.conf import settings
from django.core.management.base import BaseCommand
from api.models import CalculationJob, GeneratedSiteNdc


class Command(BaseCommand):
    help = "Remove orphaned temporary rendered PDFs/PNGs in MEDIA_ROOT older than --days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Delete unreferenced temp files older than this many days (default: 7).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without removing files.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]
        cutoff = time.time() - (days * 86400)
        media_root = os.path.abspath(settings.MEDIA_ROOT)

        # Build set of active referenced relative paths so we NEVER delete live artifacts
        referenced = set()
        for url in GeneratedSiteNdc.objects.values_list("pdf_url", flat=True):
            if url and settings.MEDIA_URL in url:
                rel = url.split(settings.MEDIA_URL, 1)[1].lstrip("/")
                referenced.add(os.path.normpath(rel))

        file_fields = [
            "screenshot", "verification_screenshot", "note_de_calcul",
            "note_mat", "note_plot", "assemblage_note", "reactions_file",
            "note_de_calcul_rrh", "rrh_assemblage_note", "rrh_verification_screenshot",
            "rrh_tableau_charges", "rrh_reactions_file", "rrh_screenshot",
            "compiled_docx", "compiled_pdf",
        ]
        for row in CalculationJob.objects.values(*file_fields).iterator():
            for field_val in row.values():
                if field_val:
                    referenced.add(os.path.normpath(str(field_val)))

        # Scan transient artifact directories
        target_dirs = [
            ("notes_de_calcul", (".png", ".pdf")),
            ("notes_rrh", (".png", ".pdf")),
            ("notes_rru", (".png", ".pdf")),
            ("assemblages", (".png", ".pdf")),
            ("uploads", (".pdf",)),
        ]

        deleted_count = 0
        reclaimed_bytes = 0

        for subdir, exts in target_dirs:
            full_dir = os.path.join(media_root, subdir)
            if not os.path.isdir(full_dir):
                continue
            for entry in os.listdir(full_dir):
                if not entry.lower().endswith(exts):
                    continue
                if subdir == "uploads" and not entry.startswith(("NDC_", "AUX_", "SITE_NDC_")):
                    continue
                full_path = os.path.join(full_dir, entry)
                if not os.path.isfile(full_path):
                    continue
                rel_path = os.path.normpath(os.path.relpath(full_path, media_root))
                if rel_path in referenced:
                    continue
                try:
                    stat = os.stat(full_path)
                except OSError:
                    continue
                if stat.st_mtime >= cutoff:
                    continue

                reclaimed_bytes += stat.st_size
                deleted_count += 1
                if dry_run:
                    self.stdout.write(f"[DRY-RUN] Would delete {rel_path} ({stat.st_size} bytes)")
                else:
                    try:
                        os.remove(full_path)
                    except OSError as exc:
                        self.stderr.write(f"Failed to remove {rel_path}: {exc}")

        mb = reclaimed_bytes / (1024 * 1024)
        verb = "Would reclaim" if dry_run else "Reclaimed"
        self.stdout.write(
            self.style.SUCCESS(f"{verb} {mb:.2f} MB across {deleted_count} orphaned temp files.")
        )

