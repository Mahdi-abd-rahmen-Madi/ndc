from django.core.management.base import BaseCommand
from django.db import transaction
import pandas as pd
import os
from geodata.models import AntennaEquipment, AntennaSpecification, TerrainDocumentation, TerrainLoadCalculation
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Import antenna equipment data from Excel files'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the Excel file')
        parser.add_argument('--dry-run', action='store_true', help='Run without saving data')
        parser.add_argument('--clear', action='store_true', help='Delete all existing AntennaEquipment records before import')
        parser.add_argument('--filter-name', type=str, help='Filter rows where Name contains this string (e.g. A10)')

    def handle(self, *args, **options):
        file_path = options['file_path']
        dry_run = options['dry_run']
        clear_db = options['clear']
        filter_name = options.get('filter_name')
        
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'File not found: {file_path}'))
            return

        try:
            # Read Excel file with proper headers (row 2 contains headers)
            df = pd.read_excel(file_path, header=2)
            self.stdout.write(f'Loaded {len(df)} rows from {file_path}')
            
            if filter_name:
                df = df[df.iloc[:, 0].astype(str).str.contains(filter_name, na=False, case=False)]
                self.stdout.write(f'Filtered to {len(df)} rows containing "{filter_name}" in Name')

            if dry_run:
                self.stdout.write(self.style.WARNING('DRY RUN - No data will be saved'))
            
            with transaction.atomic():
                if clear_db and not dry_run:
                    deleted_count, _ = AntennaEquipment.objects.all().delete()
                    self.stdout.write(self.style.WARNING(f'Cleared {deleted_count} existing AntennaEquipment records.'))
                
                imported_count = 0
                for index, row in df.iterrows():
                    if pd.isna(row['Name']):
                        continue
                        
                    item_id_col = 'Item ID (auto generated)'
                    region_val = str(int(row['REGION'])) if pd.notna(row['REGION']) else ''
                    if item_id_col in row and pd.notna(row[item_id_col]):
                        item_id_val = str(int(row[item_id_col]))
                    else:
                        base_name = str(row['Name']).strip().replace(' ', '_').lower()
                        if region_val:
                            item_id_val = f"{base_name}_r{region_val}"
                        else:
                            item_id_val = base_name

                    equipment_data = {
                        'name': str(row['Name']).strip(),
                        'sub_elements': str(row['Sous-éléments']) if pd.notna(row['Sous-éléments']) else '',
                        'responsible_person': str(row['Personne']).strip() if 'Personne' in row and pd.notna(row['Personne']) else '',
                        'status': str(row['Statut']) if 'Statut' in row and pd.notna(row['Statut']) else '',
                        'region': int(row['REGION']) if 'REGION' in row and pd.notna(row['REGION']) and str(row['REGION']).strip() else None,
                        'building_height': float(row['Hauteur BATIMENT (m)']) if pd.notna(row['Hauteur BATIMENT (m)']) else None,
                        'mast_height': float(row['Hauteur MAT (m)']) if pd.notna(row['Hauteur MAT (m)']) else None,
                        'reference_4g': str(row['Référence 4G']).strip() if 'Référence 4G' in row and pd.notna(row['Référence 4G']) else None,
                        'reference_5g': str(row['Référence 5G']).strip() if 'Référence 5G' in row and pd.notna(row['Référence 5G']) else None,
                        'comments': str(row['Commentaire']).strip() if 'Commentaire' in row and pd.notna(row['Commentaire']) else '',
                        'item_id': item_id_val,
                    }
                    
                    if not dry_run:
                        equipment, created = AntennaEquipment.objects.update_or_create(
                            item_id=equipment_data['item_id'],
                            defaults=equipment_data
                        )
                    else:
                        equipment = AntennaEquipment(**equipment_data)
                    
                    # Create 4G antenna specification
                    if pd.notna(row['Hauteur 4G (mm)']):
                        spec_4g_data = {
                            'equipment': equipment,
                            'antenna_type': '4G',
                            'height_mm': float(row['Hauteur 4G (mm)']),
                            'width_mm': float(row['Largeur 4G (mm)']),
                            'thickness_mm': float(row['Epaisseur 4G (mm)']),
                            'weight_dan': float(row['Poids 4G (daN)']),
                        }
                        if not dry_run:
                            AntennaSpecification.objects.update_or_create(
                                equipment=equipment,
                                antenna_type='4G',
                                defaults=spec_4g_data
                            )
                    
                    # Create 5G antenna specification
                    if pd.notna(row['Hauteur 5G (mm)']):
                        spec_5g_data = {
                            'equipment': equipment,
                            'antenna_type': '5G',
                            'height_mm': float(row['Hauteur 5G (mm)']),
                            'width_mm': float(row['Largeur 5G (mm)']),
                            'thickness_mm': float(row['Epaisseur 5G (mm)']),
                            'weight_dan': float(row['Poids 5G (daN)']),
                        }
                        if not dry_run:
                            AntennaSpecification.objects.update_or_create(
                                equipment=equipment,
                                antenna_type='5G',
                                defaults=spec_5g_data
                            )
                    
                    # Create terrain documentation and load calculations
                    
                    TERRAIN_COLS = {
                        '0': {
                            'doc': 'Terrain 0',
                            'material_specification': 'Section Mat Terrain 0',
                            'plot_metallique': 'Section Plot Métalliquue',
                            'bras_de_deport': 'Section Bras de déport',
                            'mat_secondaire': 'Section mat antenne 5G'
                        },
                        'II': {
                            'doc': 'Terrain II',
                            'material_specification': 'Section Mat Terrain II',
                            'plot_metallique': 'Section Plot métallique',
                            'bras_de_deport': 'Section Bras de déport.1',
                            'mat_secondaire': 'Section Mat antenne 5G'
                        },
                        'IIIa': {
                            'doc': 'Terrain IIIa',
                            'material_specification': 'Section Mat T errain IIIa',
                            'plot_metallique': 'Section Plot Métallique',
                            'bras_de_deport': 'Section Bras de déport.2',
                            'mat_secondaire': 'Section Mat antenne 5G.1'
                        },
                        'IIIb': {
                            'doc': 'Terrain IIIb',
                            'material_specification': 'Section Mat Terrain IIIb',
                            'plot_metallique': 'Section Plot Métallique.1',
                            'bras_de_deport': 'Section Bras de déport.3',
                            'mat_secondaire': 'Section Mat antenne 5G.2'
                        },
                        'IV': {
                            'doc': 'Terrain IV',
                            'material_specification': 'Section Mat Terrain IV',
                            'plot_metallique': 'Section Plot Métallique.2',
                            'bras_de_deport': 'Section Bras de déport.4',
                            'mat_secondaire': 'Section Mat antenne 5G.3'
                        }
                    }

                    terrain_types = ['0', 'II', 'IIIa', 'IIIb', 'IV']
                    for terrain_type in terrain_types:
                        cols = TERRAIN_COLS[terrain_type]
                        terrain_col = cols['doc']
                        section_col = cols['material_specification']
                        
                        doc_url = str(row[terrain_col]) if terrain_col in row and pd.notna(row[terrain_col]) else ''
                        if doc_url.strip():
                            doc_data = {
                                'equipment': equipment,
                                'terrain_type': terrain_type,
                                'document_urls': doc_url,
                                'document_types': self.extract_file_types(doc_url),
                            }
                            
                            if not dry_run:
                                terrain_doc, created = TerrainDocumentation.objects.update_or_create(
                                    equipment=equipment,
                                    terrain_type=terrain_type,
                                    defaults=doc_data
                                )
                            else:
                                terrain_doc = TerrainDocumentation(**doc_data)
                            
                            # Load calculation with material specification
                            mat_spec = str(row[section_col]).strip() if section_col in row and pd.notna(row[section_col]) else ''
                            plot_met = str(row[cols['plot_metallique']]).strip() if cols['plot_metallique'] in row and pd.notna(row[cols['plot_metallique']]) else ''
                            bras_dep = str(row[cols['bras_de_deport']]).strip() if cols['bras_de_deport'] in row and pd.notna(row[cols['bras_de_deport']]) else ''
                            mat_sec = str(row[cols['mat_secondaire']]).strip() if cols['mat_secondaire'] in row and pd.notna(row[cols['mat_secondaire']]) else ''
                            
                            if mat_spec or plot_met or bras_dep or mat_sec:
                                load_data = {
                                    'equipment': equipment,
                                    'terrain_type': terrain_type,
                                    'material_specification': mat_spec,
                                    'plot_metallique': plot_met,
                                    'bras_de_deport': bras_dep,
                                    'mat_secondaire': mat_sec,
                                    'documentation': terrain_doc if not dry_run else None,
                                }
                                
                                if not dry_run:
                                    TerrainLoadCalculation.objects.update_or_create(
                                        equipment=equipment,
                                        terrain_type=terrain_type,
                                        defaults=load_data
                                    )
                    
                    imported_count += 1
                    if index % 5 == 0:
                        self.stdout.write(f'Processed {index + 1}/{len(df)} rows...')
                
                action = "would be" if dry_run else "were"
                self.stdout.write(self.style.SUCCESS(f'Success! {imported_count} equipment records {action} imported'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error importing data: {str(e)}'))
            raise

    def extract_file_types(self, document_urls):
        """Extract file extensions from document URLs"""
        file_types = []
        if document_urls:
            urls = [url.strip() for url in document_urls.split(',') if url.strip()]
            for url in urls:
                if '.' in url:
                    ext = '.' + url.split('.')[-1].lower()
                    if ext not in file_types:
                        file_types.append(ext)
        return file_types
