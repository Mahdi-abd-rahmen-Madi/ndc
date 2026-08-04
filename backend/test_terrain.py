import os
import sys
import django
import time

# Setup django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from geodata.services import TerrainClassificationService

def test():
    service = TerrainClassificationService.get_instance()
    
    # Coordinate somewhere in France (e.g. Paris or coastal area)
    # 48.8566, 2.3522 (Paris)
    # Let's test Paris
    lon, lat = 2.3522, 48.8566
    
    print(f"Testing classification for lon={lon}, lat={lat}")
    start = time.time()
    
    # Run once (cold start for DB pool etc, but no local python cache anymore)
    res = service.get_terrain_type_at_coordinates(lon, lat)
    end = time.time()
    print(f"Result 1: {res}")
    print(f"Time 1: {end - start:.4f}s")
    
    # Run twice
    start2 = time.time()
    res2 = service.get_terrain_type_at_coordinates(lon, lat)
    end2 = time.time()
    print(f"Result 2: {res2}")
    print(f"Time 2: {end2 - start2:.4f}s")

if __name__ == '__main__':
    test()
