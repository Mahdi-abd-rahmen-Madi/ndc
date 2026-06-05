import os
import zipfile
import requests
import tempfile
import subprocess
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import GEOSGeometry
from django.contrib.gis.gdal import DataSource
from django.conf import settings
from django.utils import timezone
import pytz
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm
import time
import logging
import traceback
import shutil

from geodata.models import Building, CadastreUpdateStatus

class Command(BaseCommand):
    help = 'Import building data from Etalab French cadastre'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--departments',
            nargs='+',
            type=str,
            help='Department codes to update (e.g., 01 30 75 2A 2B). If not specified, updates all metropolitan departments.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update even if data was recently updated'
        )
        parser.add_argument(
            '--data-version',
            type=str,
            default='latest',
            help='Cadastre data version (e.g., "2025-09-01"). Defaults to "latest".'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=5000,
            help='Number of records to process in each batch'
        )
        parser.add_argument(
            '--temp-dir',
            type=str,
            default=tempfile.gettempdir(),
            help='Temporary directory for downloads and processing'
        )
        parser.add_argument(
            '--output-dir',
            type=str,
            default='/home/mahdi/CascadeProjects/ndc/backend/data/cadastre',
            help='Directory to store processed FlatGeobuf files'
        )
        parser.add_argument(
            '--skip-validation',
            action='store_true',
            help='Skip geometry validation for faster imports (use with caution)'
        )
    
    def handle(self, *args, **options):
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s %(levelname)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        self.logger = logging.getLogger(__name__)
        
        departments = options['departments']
        force_update = options['force']
        data_version = options['data_version']
        batch_size = options['batch_size']
        temp_dir = options['temp_dir']
        output_dir = options['output_dir']
        skip_validation = options['skip_validation']
        
        # Validate and create directories
        try:
            os.makedirs(temp_dir, exist_ok=True)
            os.makedirs(output_dir, exist_ok=True)
            self.stdout.write(f"📁 Using temp directory: {temp_dir}")
            self.stdout.write(f"📁 Using output directory: {output_dir}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Directory creation failed: {str(e)}"))
            return
        
        # Get departments to process
        if not departments:
            departments = self.get_all_metropolitan_departments()
            self.stdout.write(f"🔄 Processing all metropolitan departments: {', '.join(departments)}")
        else:
            departments = [self.format_department_code(dept) for dept in departments]
            self.stdout.write(f"🔄 Processing specified departments: {', '.join(departments)}")
        
        # Base URL for cadastre data
        base_url = f"https://cadastre.data.gouv.fr/data/etalab-cadastre/{data_version}/shp/departements"
        
        # Process each department
        total_buildings_imported = 0
        failed_departments = []
        
        for dept_code in departments:
            dept_start_time = time.time()
            self.stdout.write(f"\n{'='*60}")
            self.stdout.write(f"📍 PROCESSING DEPARTMENT: {dept_code} (BUILDINGS)")
            self.stdout.write(f"{'='*60}")
            
            try:
                # Check if update needed
                if not force_update and not self.needs_update(dept_code, 'buildings'):
                    self.stdout.write(self.style.WARNING(
                        f"⏩ Skipping department {dept_code} - recently updated (within last 30 days)"
                    ))
                    continue
                
                # Process buildings
                buildings_path = self.download_cadastre_file(
                    base_url, dept_code, 'batiments', temp_dir
                )
                building_count = 0
                if buildings_path:
                    building_count = self.process_and_import_buildings(
                        buildings_path, dept_code, output_dir, batch_size, skip_validation
                    )
                    total_buildings_imported += building_count
                    self.cleanup_file(buildings_path)
                else:
                    self.stdout.write(self.style.ERROR(
                        f"❌ Skipping buildings processing for {dept_code} due to download failure"
                    ))
                
                # Update status if buildings were processed
                if building_count > 0:
                    self.update_status(dept_code, building_count, 'buildings')
                
                dept_duration = time.time() - dept_start_time
                self.stdout.write(self.style.SUCCESS(
                    f"✅ Department {dept_code} completed in {dept_duration:.1f} seconds | "
                    f"Buildings: {building_count}"
                ))
            except Exception as e:
                error_msg = f"💥 CRITICAL FAILURE processing department {dept_code}: {str(e)}"
                self.stdout.write(self.style.ERROR(error_msg))
                self.logger.error(error_msg)
                self.logger.error(traceback.format_exc())
                failed_departments.append(dept_code)
                continue
        
        # Final summary
        self.stdout.write("\n" + "="*70)
        self.stdout.write(self.style.SUCCESS("🎉 CADASTRE BUILDINGS IMPORT COMPLETE"))
        self.stdout.write(f"🏢 Total Buildings Processed: {total_buildings_imported}")
        self.stdout.write(f"✅ Total Departments Processed: {len(departments) - len(failed_departments)}")
        if failed_departments:
            self.stdout.write(self.style.ERROR(f"❌ Failed Departments ({len(failed_departments)}): {', '.join(failed_departments)}"))
        self.stdout.write("="*70)
    
    def get_all_metropolitan_departments(self):
        """Return all valid metropolitan French department codes including Corsica"""
        valid_departments = [
            '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
            '11', '12', '13', '14', '15', '16', '17', '18', '19', '21',
            '22', '23', '24', '25', '26', '27', '28', '29', '30', '31',
            '32', '33', '34', '35', '36', '37', '38', '39', '40', '41',
            '42', '43', '44', '45', '46', '47', '48', '49', '50', '51',
            '52', '53', '54', '55', '56', '57', '58', '59', '60', '61',
            '62', '63', '64', '65', '66', '67', '68', '69', '70', '71',
            '72', '73', '74', '75', '76', '77', '78', '79', '80', '81',
            '82', '83', '84', '85', '86', '87', '88', '89', '90', '91',
            '92', '93', '94', '95', '2A', '2B'
        ]
        return valid_departments
    
    def format_department_code(self, dept_code):
        """Format department code properly with validation"""
        dept_code = dept_code.strip().upper()
        valid_codes = self.get_all_metropolitan_departments()
        if dept_code not in valid_codes:
            raise ValueError(f"Invalid department code: {dept_code}. Valid codes are: {', '.join(valid_codes)}")
        return dept_code
    
    def needs_update(self, dept_code, data_type):
        """Check if department cadastre data needs updating"""
        try:
            status = CadastreUpdateStatus.objects.get(department_code=dept_code, data_type=data_type)
            days_since_update = (timezone.now().date() - status.last_update.date()).days
            return days_since_update > 30  # Update monthly
        except CadastreUpdateStatus.DoesNotExist:
            self.stdout.write(f"ℹ️ No previous update record for department {dept_code} {data_type}")
            return True
    
    def download_cadastre_file(self, base_url, dept_code, data_type, temp_dir):
        """Download cadastre shapefile with comprehensive error handling and ZIP validation"""
        filename = f"cadastre-{dept_code}-{data_type}-shp.zip"
        local_path = os.path.join(temp_dir, filename)
        remote_url = f"{base_url}/{dept_code}/{filename}"
        self.stdout.write(f"⤵️ Downloading {data_type} for department {dept_code}")
        self.stdout.write(f"  🌐 URL: {remote_url}")
        
        try:
            # Check if file exists and is a valid ZIP
            if os.path.exists(local_path):
                try:
                    # Test if it's a valid ZIP file
                    with zipfile.ZipFile(local_path, 'r') as zip_ref:
                        zip_ref.testzip()  # This will raise an exception if the ZIP is corrupted
                    self.stdout.write(self.style.WARNING(f"  ⚠️ Valid ZIP file already exists at {local_path}, reusing it"))
                    return local_path
                except (zipfile.BadZipFile, RuntimeError) as e:
                    self.stdout.write(self.style.WARNING(f"  ⚠️ Corrupted ZIP file at {local_path}, will redownload: {e}"))
                    os.remove(local_path)
            
            # Download the file
            response = requests.get(remote_url, stream=True, timeout=600)
            response.raise_for_status()
            total_size = int(response.headers.get('content-length', 0))
            block_size = 8192
            
            with open(local_path, 'wb') as f, tqdm(
                total=total_size, 
                unit='iB', 
                unit_scale=True,
                desc=f"  {dept_code} {data_type}",
                ncols=80
            ) as pbar:
                for data in response.iter_content(block_size):
                    size = f.write(data)
                    pbar.update(size)
            
            downloaded_size = os.path.getsize(local_path)
            if total_size > 0 and downloaded_size < total_size * 0.95:
                error_msg = f"Incomplete download for {filename}"
                self.stdout.write(self.style.ERROR(f"  ❌ {error_msg}"))
                os.remove(local_path)
                raise Exception(error_msg)
            
            # Validate the downloaded ZIP file
            try:
                with zipfile.ZipFile(local_path, 'r') as zip_ref:
                    zip_ref.testzip()
                self.stdout.write(self.style.SUCCESS(
                    f"  ✅ Downloaded {data_type} ({downloaded_size / 1024 / 1024:.1f} MB) and validated as valid ZIP"
                ))
                return local_path
            except (zipfile.BadZipFile, RuntimeError) as e:
                error_msg = f"Downloaded file is not a valid ZIP: {e}"
                self.stdout.write(self.style.ERROR(f"  ❌ {error_msg}"))
                os.remove(local_path)
                raise Exception(error_msg)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ❌ Error: {str(e)}"))
            if os.path.exists(local_path):
                os.remove(local_path)
            return None
    
    def convert_and_clean_with_ogr2ogr(self, input_shp, output_fgb):
        """
        Use ogr2ogr + SQLite dialect + ST_MakeValid() to clean geometries at import.
        This is MUCH faster than Python-based geometry repair.
        """
        self.stdout.write(f"🔄 Converting and cleaning buildings with ST_MakeValid()...")
        try:
            # Get layer name from source shapefile
            ds = DataSource(input_shp)
            layer_name = ds[0].name
            ds = None
            self.stdout.write(f"  📌 Source layer name: {layer_name}")
            
            # SQL to clean geometries in one pass - use the actual layer name
            sql = f"""
            SELECT 
                *, 
                ST_MakeValid(geometry) AS geometry 
            FROM "{layer_name}"
            WHERE geometry IS NOT NULL AND NOT ST_IsEmpty(geometry)
            """
            
            cmd = [
                'ogr2ogr',
                '-f', 'FlatGeobuf',
                '-t_srs', 'EPSG:4326',  # Use WGS84 directly for better performance
                '-dialect', 'sqlite',
                '-sql', sql,
                '-nlt', 'PROMOTE_TO_MULTI',
                '-skipfailures',
                output_fgb,
                input_shp
            ]
            
            self.stdout.write(f"  🚀 Running command: {' '.join(cmd)}")
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                check=True,
                env=os.environ.copy()
            )
            
            if not os.path.exists(output_fgb) or os.path.getsize(output_fgb) == 0:
                raise Exception("ogr2ogr produced empty output")
            
            self.stdout.write(self.style.SUCCESS(f"  ✅ Cleaned and converted to {os.path.basename(output_fgb)}"))
            return output_fgb
        except subprocess.CalledProcessError as e:
            error_msg = f"ogr2ogr failed:\nSTDOUT: {e.stdout}\nSTDERR: {e.stderr}"
            self.stdout.write(self.style.ERROR(f"  ❌ {error_msg}"))
            self.logger.error(error_msg)
            if os.path.exists(output_fgb):
                os.remove(output_fgb)
            return None
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ❌ Conversion error: {str(e)}"))
            self.logger.error(str(e))
            return None
    
    def find_shapefile(self, extract_dir, pattern, feature_type=None):
        """Find shapefile with flexible pattern matching and optional feature type verification"""
        self.stdout.write(f"  🔍 Searching for shapefiles in: {extract_dir}")
        
        # List all files for debugging
        all_files = []
        for root, _, files in os.walk(extract_dir):
            for f in files:
                all_files.append(os.path.relpath(os.path.join(root, f), extract_dir))
        self.stdout.write(f"  📁 Found files: {', '.join(all_files)}")
        
        # First try direct pattern matching
        candidates = []
        for root, _, files in os.walk(extract_dir):
            for f in files:
                if f.endswith('.shp'):
                    filepath = os.path.join(root, f)
                    filename_lower = f.lower()
                    # Check if filename matches pattern
                    pattern_match = any(p in filename_lower for p in pattern)
                    # Check feature type if specified
                    type_match = True
                    if feature_type and pattern_match:
                        try:
                            ds = DataSource(filepath)
                            layer = ds[0]
                            geom_type = layer.geom_type.name.upper()
                            type_match = any(ft in geom_type for ft in feature_type)
                            ds = None  # Close datasource
                        except Exception as e:
                            self.logger.warning(f"Could not check geometry type for {filepath}: {e}")
                            type_match = False
                    
                    if pattern_match and type_match:
                        candidates.append(filepath)
        
        if candidates:
            return candidates[0]
        
        # Fallback: try any shapefile with the right geometry type
        if feature_type:
            for root, _, files in os.walk(extract_dir):
                for f in files:
                    if f.endswith('.shp'):
                        filepath = os.path.join(root, f)
                        try:
                            ds = DataSource(filepath)
                            layer = ds[0]
                            geom_type = layer.geom_type.name.upper()
                            if any(ft in geom_type for ft in feature_type):
                                self.stdout.write(f"  ⚠️ Using fallback match (geometry type): {filepath}")
                                ds = None
                                return filepath
                            ds = None
                        except Exception as e:
                            self.logger.warning(f"Could not check geometry type for {filepath}: {e}")
        
        # Last resort: return first shapefile found
        for root, _, files in os.walk(extract_dir):
            for f in files:
                if f.endswith('.shp'):
                    filepath = os.path.join(root, f)
                    self.stdout.write(f"  ⚠️ Using last resort match: {filepath}")
                    return filepath
        
        raise FileNotFoundError(f"No shapefile found matching pattern {pattern} with feature type {feature_type}")
    
    def process_and_import_buildings(self, zip_path, dept_code, output_dir, batch_size, skip_validation=False):
        """Process buildings with GDAL/OGR for maximum performance"""
        self.stdout.write("PropertyParams Processing BUILDINGS data with GDAL/OGR")
        timestamp = int(time.time())
        extract_dir = os.path.join(tempfile.gettempdir(), f"buildings_{dept_code}_{timestamp}")
        os.makedirs(extract_dir, exist_ok=True)
        
        try:
            # Extract ZIP
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Find SHP with flexible matching
            shp_file = self.find_shapefile(
                extract_dir, 
                ['batiment', 'batiments', 'building', 'buildings'], 
                ['POLYGON', 'MULTIPOLYGON']
            )
            self.stdout.write(f"  🗺️ Found shapefile: {shp_file}")
            
            # Clean and convert using ogr2ogr + ST_MakeValid
            fgb_filename = f"cadastre-{dept_code}-batiments-clean.fgb"
            fgb_path = os.path.join(output_dir, fgb_filename)
            
            if os.path.exists(fgb_path) and not skip_validation:
                self.stdout.write(self.style.WARNING(f"  ⚠️ Cleaned file already exists: {fgb_path}, reusing it"))
            else:
                fgb_path = self.convert_and_clean_with_ogr2ogr(shp_file, fgb_path)
                if not fgb_path:
                    raise Exception("ogr2ogr cleaning/conversion failed")
            
            # Use GDAL/OGR directly for maximum speed
            ds = DataSource(fgb_path)
            layer = ds[0]
            total_features = len(layer)
            self.stdout.write(f"  📈 Processing {total_features} buildings")
            
            # Get field mapping - we only need commune and type
            field_map = {
                'commune': None,
                'type': None
            }
            
            # Get all field names
            field_names = [name.lower() for name in layer.fields]
            self.stdout.write(f"  📋 Available fields: {', '.join(layer.fields)}")
            
            # Map commune field (looking for 'commune', 'insee', 'com', etc.)
            commune_candidates = ['commune', 'insee', 'com', 'commune_insee', 'code_insee', 'idcom', 'id_com']
            for candidate in commune_candidates:
                if candidate in field_names:
                    # Get the original case-sensitive field name
                    idx = field_names.index(candidate)
                    field_map['commune'] = layer.fields[idx]
                    break
            
            # Map type field (looking for 'type', 'typ', 'bat_type', etc.)
            type_candidates = ['type', 'typ', 'bat_type', 'typebat', 'nature', 'naturedet', 'type_bat']
            for candidate in type_candidates:
                if candidate in field_names:
                    # Get the original case-sensitive field name
                    idx = field_names.index(candidate)
                    field_map['type'] = layer.fields[idx]
                    break
            
            self.stdout.write(f"  🗂️ Field mapping: {field_map}")
            
            # Validate required fields
            if not field_map['commune']:
                raise ValueError(f"Missing required field 'commune'. Available fields: {', '.join(layer.fields)}")
            if not field_map['type']:
                raise ValueError(f"Missing required field 'type'. Available fields: {', '.join(layer.fields)}")
            
            # Prepare for batch processing
            batch = []
            total_imported = 0
            total_updated = 0
            total_skipped = 0
            
            # Process features
            pbar = tqdm(total=total_features, desc=f"  🏗️ Dept {dept_code} Buildings")
            for i, feature in enumerate(layer):
                try:
                    # Get geometry
                    geom = feature.geom
                    if geom is None or geom.empty:
                        total_skipped += 1
                        pbar.update(1)
                        continue
                    
                    # Extract commune (ensure 5 digits)
                    commune_value = str(feature.get(field_map['commune'])).strip()
                    if len(commune_value) > 5:
                        commune_value = commune_value[:5]
                    elif len(commune_value) < 5:
                        commune_value = commune_value.zfill(5)
                    
                    # Extract building type (ensure 2 digits)
                    type_value = str(feature.get(field_map['type'])).strip()
                    if len(type_value) > 2:
                        type_value = type_value[:2]
                    elif len(type_value) < 2:
                        type_value = type_value.zfill(2)
                    
                    # Create unique ID using commune + type + index (as a fallback unique identifier)
                    building_id = f"{commune_value}_{type_value}_{i}"
                    
                    # Create record for batch insert with centroid
                    utc_now = timezone.now().astimezone(pytz.UTC)
                    centroid = None
                    try:
                        if geom and not geom.empty:
                            centroid = geom.centroid.wkt if hasattr(geom, 'centroid') else None
                    except Exception as e:
                        self.logger.warning(f"Error calculating centroid for building in commune {commune_value}: {e}")
                    
                    batch.append((
                        building_id,                # id
                        commune_value,              # commune_insee
                        type_value,                 # building_type
                        geom.wkt,                   # geometry
                        centroid,                   # centroid
                        dept_code,                  # department_code
                        'etalab_cadastre',          # data_source
                        utc_now                     # last_import
                    ))
                    
                    # Process batch when full
                    if len(batch) >= batch_size:
                        inserted, updated, skipped = self.bulk_import_buildings(batch)
                        total_imported += inserted
                        total_updated += updated
                        total_skipped += skipped
                        batch = []
                except Exception as e:
                    self.logger.warning(f"Error processing building feature {i}: {e}")
                    total_skipped += 1
                finally:
                    pbar.update(1)
            
            # Process remaining items in batch
            if batch:
                inserted, updated, skipped = self.bulk_import_buildings(batch)
                total_imported += inserted
                total_updated += updated
                total_skipped += skipped
            
            pbar.close()
            self.stdout.write(self.style.SUCCESS(
                f"  ✅ Summary: imported {total_imported}, updated {total_updated}, skipped {total_skipped}"
            ))
            
            # Add post-import validation step to fix any remaining invalid geometries
            if not skip_validation:
                self.fix_invalid_geometries(dept_code)
                
            return total_imported + total_updated
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Critical error: {e}"))
            self.logger.error(traceback.format_exc())
            return 0
        finally:
            ds = None  # Close DataSource
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir, ignore_errors=True)
    
    def bulk_import_buildings(self, batch):
        """Bulk import buildings using PostgreSQL COPY for maximum speed"""
        conn = psycopg2.connect(
            dbname=settings.DATABASES['default']['NAME'],
            user=settings.DATABASES['default']['USER'],
            password=settings.DATABASES['default']['PASSWORD'],
            host=settings.DATABASES['default']['HOST'],
            port=settings.DATABASES['default']['PORT']
        )
        cursor = conn.cursor()
        
        # Prepare data for import
        insert_data = []
        update_data = []
        
        # Check which buildings already exist (by ID)
        ids = [item[0] for item in batch]
        cursor.execute("""
            SELECT id FROM geodata_building WHERE id IN %s
        """, (tuple(ids),))
        existing_ids = set(row[0] for row in cursor.fetchall())
        
        for item in batch:
            building_id = item[0]
            if building_id in existing_ids:
                update_data.append(item)
            else:
                insert_data.append(item)
        
        inserted = 0
        updated = 0
        skipped = 0
        
        # Insert new buildings
        if insert_data:
            try:
                execute_values(cursor, """
                    INSERT INTO geodata_building (
                        id, 
                        commune_insee,
                        building_type,
                        geometry, 
                        centroid,
                        department_code, 
                        data_source, 
                        last_import
                    ) VALUES %s
                    ON CONFLICT (id) DO NOTHING
                """, insert_data)
                inserted = cursor.rowcount
                conn.commit()
            except Exception as e:
                self.logger.error(f"Batch insert failed: {e}")
                self.logger.error(f"Sample insert data: {insert_data[:3]}")
                conn.rollback()
                skipped += len(insert_data) - inserted
        
        # Update existing buildings
        if update_data:
            try:
                # Create a temporary table for the update data
                cursor.execute("""
                    CREATE TEMP TABLE temp_building_update (
                        id VARCHAR(50),
                        commune VARCHAR(5),
                        type VARCHAR(2),
                        geometry GEOMETRY(MultiPolygon,4326),
                        centroid GEOMETRY(Point,4326),
                        department_code VARCHAR(3),
                        data_source VARCHAR(20),
                        last_import TIMESTAMP WITH TIME ZONE
                    )
                """)
                
                # Insert update data into temp table
                execute_values(cursor, """
                    INSERT INTO temp_building_update VALUES %s
                """, update_data)
                
                # Update from temp table
                cursor.execute("""
                    UPDATE geodata_building b
                    SET 
                        commune_insee = t.commune,
                        building_type = t.type,
                        geometry = ST_Multi(ST_CollectionExtract(ST_ForceCollection(ST_MakeValid(t.geometry)), 3)),
                        centroid = ST_Centroid(ST_Multi(ST_CollectionExtract(ST_ForceCollection(ST_MakeValid(t.geometry)), 3))),
                        department_code = t.department_code,
                        data_source = t.data_source,
                        last_import = t.last_import
                    FROM temp_building_update t
                    WHERE b.id = t.id
                """)
                updated = cursor.rowcount
                conn.commit()
            except Exception as e:
                self.logger.error(f"Batch update failed: {e}")
                self.logger.error(f"Sample update data: {update_data[:3]}")
                conn.rollback()
                skipped += len(update_data) - updated
        
        cursor.close()
        conn.close()
        return inserted, updated, skipped
    
    def update_status(self, dept_code, count, data_type):
        """Update cadastre update status for buildings"""
        utc_now = timezone.now().astimezone(pytz.UTC)
        status, created = CadastreUpdateStatus.objects.update_or_create(
            department_code=dept_code,
            data_type=data_type,
            defaults={
                'last_update': utc_now,
                'record_count': count,
                'status': 'SUCCESS',
                'data_version': utc_now.strftime('%Y-%m-%d')
            }
        )
        self.stdout.write(f"  💾 {'Created' if created else 'Updated'} status for {dept_code} {data_type}")
        return status
    
    def cleanup_file(self, file_path):
        """Clean up temp file"""
        if file_path and os.path.exists(file_path):
            try:
                size_mb = os.path.getsize(file_path) / (1024**2)
                os.remove(file_path)
                self.stdout.write(f"  🧹 Cleaned up ({size_mb:.1f} MB): {file_path}")
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"⚠️ Cleanup failed: {e}"))
    
    # Add this method to the Command class
    def fix_invalid_geometries(self, dept_code):
        """Fix any invalid geometries in the buildings table"""
        conn = psycopg2.connect(
            dbname=settings.DATABASES['default']['NAME'],
            user=settings.DATABASES['default']['USER'],
            password=settings.DATABASES['default']['PASSWORD'],
            host=settings.DATABASES['default']['HOST'],
            port=settings.DATABASES['default']['PORT']
        )
        cursor = conn.cursor()
        
        try:
            # Fix invalid geometries and update centroids
            cursor.execute("""
                WITH fixed_geometries AS (
                    SELECT 
                        id,
                        ST_Multi(ST_CollectionExtract(ST_ForceCollection(ST_MakeValid(geometry)), 3)) as fixed_geom
                    FROM geodata_building
                    WHERE department_code = %s 
                    AND NOT ST_IsValid(geometry)
                )
                UPDATE geodata_building b
                SET 
                    geometry = fg.fixed_geom,
                    centroid = ST_Centroid(fg.fixed_geom)
                FROM fixed_geometries fg
                WHERE b.id = fg.id
                RETURNING b.id
            """, (dept_code,))
            
            fixed_count = cursor.rowcount
            conn.commit()
            
            if fixed_count > 0:
                self.stdout.write(self.style.SUCCESS(f"  ✅ Fixed {fixed_count} invalid geometries in geodata_building"))
            else:
                self.stdout.write("  ℹ️ No invalid geometries found in geodata_building")
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ❌ Error fixing invalid geometries: {e}"))
            conn.rollback()
        finally:
            cursor.close()
            conn.close()