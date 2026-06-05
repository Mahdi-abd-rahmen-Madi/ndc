import os
import requests
import urllib.parse
from django.core.management.base import BaseCommand
from django.conf import settings
from geodata.models import TerrainDocumentation
import browser_cookie3


class Command(BaseCommand):
    help = 'Download Monday.com calculations files using Chrome cookies and save them locally'

    def add_arguments(self, parser):
        parser.add_argument(
            '--manual-cookie',
            type=str,
            help='Pass raw Cookie header string if Chrome extraction fails'
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Redownload files even if they already exist locally'
        )

    def handle(self, *args, **options):
        # 1. Ensure MEDIA_ROOT exists
        if not hasattr(settings, 'MEDIA_ROOT') or not settings.MEDIA_ROOT:
            self.stdout.write(self.style.ERROR("MEDIA_ROOT is not configured in settings.py!"))
            return

        catalogue_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue')
        os.makedirs(catalogue_dir, exist_ok=True)

        # 2. Get cookies
        cookie_jar = None
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        if options['manual_cookie']:
            headers['Cookie'] = options['manual_cookie']
            self.stdout.write(self.style.SUCCESS("Using manually provided cookie string"))
        else:
            self.stdout.write("Attempting to extract Monday.com session cookies from Google Chrome...")
            try:
                # Retrieve cookies from default Chrome cookies database
                cookie_jar = browser_cookie3.chrome(domain_name='monday.com')
                self.stdout.write(self.style.SUCCESS(f"Successfully loaded {len(cookie_jar)} cookies from Google Chrome"))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Could not load cookies from Google Chrome automatically: {e}"))
                self.stdout.write(self.style.WARNING("Please make sure Google Chrome is open and logged into monday.com, or provide cookies manually with --manual-cookie"))

        # 3. Iterate over documentations
        docs = TerrainDocumentation.objects.all()
        total_docs = docs.count()
        self.stdout.write(f"Found {total_docs} TerrainDocumentation entries to check")

        success_count = 0
        skipped_count = 0
        failed_count = 0

        for doc in docs:
            equipment = doc.equipment
            terrain_type = doc.terrain_type
            
            if not doc.document_urls or not str(doc.document_urls).strip():
                continue

            urls = [u.strip() for u in str(doc.document_urls).split(',') if u.strip()]
            local_urls_list = []

            self.stdout.write(f"Processing documentation for {equipment.name} ({terrain_type})")

            # Output folder structure: media/catalogue/{equipment_item_id}/{terrain_type}/
            safe_item_id = (equipment.item_id or str(equipment.id)).replace(' ', '_').lower()
            dest_folder = os.path.join(catalogue_dir, safe_item_id, terrain_type)
            os.makedirs(dest_folder, exist_ok=True)

            for url in urls:
                if not url.startswith('http'):
                    continue

                # Parse filename
                parsed_url = urllib.parse.urlparse(url)
                filename = os.path.basename(parsed_url.path)
                if not filename:
                    filename = 'document'
                
                # Unquote URL characters (e.g. %20 -> space)
                filename = urllib.parse.unquote(filename)
                
                # Settle output filepath
                local_filepath = os.path.join(dest_folder, filename)
                local_url = f"{settings.MEDIA_URL}catalogue/{safe_item_id}/{terrain_type}/{filename}"

                # Download if doesn't exist or overwrite is set
                if not os.path.exists(local_filepath) or options['overwrite']:
                    self.stdout.write(f"  Downloading: {url}")
                    try:
                        if cookie_jar:
                            res = requests.get(url, headers=headers, cookies=cookie_jar, timeout=30)
                        else:
                            res = requests.get(url, headers=headers, timeout=30)

                        if res.status_code == 200:
                            # Verify if we got actual document or a login screen HTML redirect
                            content_type = res.headers.get('Content-Type', '')
                            if 'text/html' in content_type and ('login' in res.text or 'signup' in res.text or 'monday.com' in res.text.lower()):
                                self.stdout.write(self.style.ERROR(f"    Failed: Got login/signup HTML redirect for {filename}. Session might be expired or invalid."))
                                failed_count += 1
                                continue

                            with open(local_filepath, 'wb') as f:
                                f.write(res.content)
                            self.stdout.write(self.style.SUCCESS(f"    Saved: {local_filepath}"))
                            local_urls_list.append(local_url)
                            success_count += 1
                        else:
                            self.stdout.write(self.style.ERROR(f"    Failed to download: HTTP status {res.status_code}"))
                            failed_count += 1
                    except Exception as err:
                        self.stdout.write(self.style.ERROR(f"    Error downloading: {err}"))
                        failed_count += 1
                else:
                    self.stdout.write(f"  File already exists: {filename}")
                    local_urls_list.append(local_url)
                    skipped_count += 1

            # Update database
            if local_urls_list:
                doc.local_document_urls = ','.join(local_urls_list)
                doc.save()
                self.stdout.write(self.style.SUCCESS(f"  Updated DB local URLs: {doc.local_document_urls}"))

        self.stdout.write(self.style.SUCCESS(
            f"Done! Success: {success_count}, Skipped (Already exists): {skipped_count}, Failed: {failed_count}"
        ))
