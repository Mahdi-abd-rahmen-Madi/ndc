import os
import subprocess
import logging
from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Convert all DOCX/DOC files in media/catalogue to PDF using LibreOffice'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Re-convert files even if the PDF already exists'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List files that would be converted without actually converting'
        )

    def handle(self, *args, **options):
        catalogue_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue')

        if not os.path.isdir(catalogue_dir):
            self.stdout.write(self.style.ERROR(
                f"Catalogue directory not found: {catalogue_dir}"
            ))
            return

        overwrite = options['overwrite']
        dry_run = options['dry_run']

        # Collect all .docx and .doc files
        doc_files = []
        for root, _dirs, files in os.walk(catalogue_dir):
            for fname in files:
                lower = fname.lower()
                if lower.endswith('.docx') or lower.endswith('.doc'):
                    doc_files.append(os.path.join(root, fname))

        total = len(doc_files)
        self.stdout.write(f"Found {total} DOCX/DOC file(s) in {catalogue_dir}")

        if total == 0:
            return

        to_convert = []
        skipped = 0
        converted = 0
        failed = 0

        for doc_path in doc_files:
            pdf_path = os.path.splitext(doc_path)[0] + '.pdf'
            rel_path = os.path.relpath(doc_path, settings.MEDIA_ROOT)

            if os.path.exists(pdf_path) and not overwrite:
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f"  WOULD CONVERT: {rel_path}")
                converted += 1
                continue

            to_convert.append(doc_path)

        if dry_run or not to_convert:
            self.stdout.write("")
            self.stdout.write(self.style.SUCCESS(
                f"Done! Converted: {converted}, Skipped: {skipped}, Failed: {failed}"
            ))
            return

        self.stdout.write(f"Converting {len(to_convert)} file(s) using 4 parallel workers...")

        from concurrent.futures import ThreadPoolExecutor, as_completed
        import threading
        import shutil

        # Define conversion helper
        def convert_single_file(doc_path):
            pdf_path = os.path.splitext(doc_path)[0] + '.pdf'
            rel_path = os.path.relpath(doc_path, settings.MEDIA_ROOT)
            outdir = os.path.dirname(doc_path)
            
            thread_id = threading.get_ident()
            profile_dir = os.path.join(settings.BASE_DIR, f".libreoffice_profile_{thread_id}")
            
            cmd = [
                'libreoffice',
                f'-env:UserInstallation=file://{profile_dir}',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', outdir,
                doc_path
            ]
            
            error_msg = ""
            try:
                result = subprocess.run(
                    cmd,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=120
                )
                success = os.path.exists(pdf_path)
                if not success:
                    error_msg = f"PDF not created. Output: {result.stdout.decode().strip()}"
            except subprocess.TimeoutExpired:
                success = False
                error_msg = "Conversion timed out (120s)"
            except subprocess.CalledProcessError as e:
                success = False
                error_msg = e.stderr.decode().strip()
            finally:
                if os.path.exists(profile_dir):
                    try:
                        shutil.rmtree(profile_dir)
                    except Exception:
                        pass
            return success, rel_path, error_msg

        # Run parallel executor
        with ThreadPoolExecutor(max_workers=4) as executor:
            future_to_file = {executor.submit(convert_single_file, path): path for path in to_convert}
            
            completed_count = 0
            total_to_convert = len(to_convert)
            for future in as_completed(future_to_file):
                completed_count += 1
                success, rel_path, error_msg = future.result()
                if success:
                    self.stdout.write(self.style.SUCCESS(
                        f"  [{completed_count}/{total_to_convert}] OK: {rel_path}"
                    ))
                    converted += 1
                else:
                    self.stdout.write(self.style.ERROR(
                        f"  [{completed_count}/{total_to_convert}] FAIL: {rel_path} -> {error_msg}"
                    ))
                    failed += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done! Converted: {converted}, Skipped: {skipped}, Failed: {failed}"
        ))
