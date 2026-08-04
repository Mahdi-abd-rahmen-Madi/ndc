import os
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection
import geopandas as gpd

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Import OS_FRANCE.fgb into PostGIS'

    def handle(self, *args, **options):
        fgb_path = os.path.join(settings.BASE_DIR, 'backend', 'data', 'OS_FRANCE.fgb')
        
        if not os.path.exists(fgb_path):
            # Try without backend/ prefix if we're already inside backend/
            fgb_path = os.path.join(settings.BASE_DIR, 'data', 'OS_FRANCE.fgb')
            
        if not os.path.exists(fgb_path):
            self.stderr.write(self.style.ERROR(f'File not found: {fgb_path}'))
            return
            
        self.stdout.write(self.style.SUCCESS(f'Found {fgb_path}. Connecting to database...'))
        
        # Get sqlalchemy engine from django database connection
        # It's better to use sqlalchemy with geopandas
        from sqlalchemy import create_engine
        
        # Build connection string
        db_settings = settings.DATABASES['default']
        db_user = db_settings.get('USER')
        db_password = db_settings.get('PASSWORD')
        db_host = db_settings.get('HOST', 'localhost')
        db_port = db_settings.get('PORT', '5432')
        db_name = db_settings.get('NAME')
        
        conn_str = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        engine = create_engine(conn_str)
        
        self.stdout.write(self.style.SUCCESS('Reading FlatGeobuf... This may take a while depending on RAM.'))
        
        try:
            # We can use chunking if memory is an issue, but let's try direct first.
            gdf = gpd.read_file(fgb_path)
            self.stdout.write(self.style.SUCCESS(f'Read {len(gdf)} features from FlatGeobuf.'))
            
            # Ensure it has a CRS
            if gdf.crs is None:
                gdf.set_crs(epsg=4326, inplace=True)
                
            self.stdout.write(self.style.SUCCESS('Uploading to PostGIS...'))
            
            # Upload to postgis
            gdf.to_postgis(
                name='land_use_data', 
                con=engine, 
                if_exists='replace', 
                index=True,
                index_label='id'
            )
            
            self.stdout.write(self.style.SUCCESS('Successfully imported to land_use_data table.'))
            
            # Create a spatial index in postgis
            with engine.connect() as conn:
                conn.execute('CREATE INDEX IF NOT EXISTS land_use_data_geom_idx ON land_use_data USING GIST (geometry);')
                
            self.stdout.write(self.style.SUCCESS('Created spatial index on geometry column.'))
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error importing FGB: {e}'))
