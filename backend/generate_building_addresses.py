#!/usr/bin/env python3
"""
Generate spatially valid French addresses with real CLC-based terrain classification
Enhanced for spatial extent-based terrain classification
"""
import os
import sys
import json
import random
import logging
from typing import List, Dict, Optional, Tuple
import warnings

# Suppress CRS warnings for cleaner output
warnings.filterwarnings('ignore', category=UserWarning, message='Geometry is in a geographic CRS')

# Set up Django environment to use terrain service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')

try:
    import django
    django.setup()
    from geodata.services import terrain_service
    DJANGO_AVAILABLE = True
    
    # Configure logging
    logging.basicConfig(level=logging.WARNING)  # Only show warnings and errors
except ImportError:
    print("Warning: Django not available, using fallback mode")
    DJANGO_AVAILABLE = False

# French street types
STREET_TYPES = [
    "Rue", "Avenue", "Boulevard", "Place", "Impasse", "Allée", 
    "Chemin", "Route", "Square", "Cour", "Passage", "Quai"
]

# Common French street names
STREET_NAMES = [
    "de la République", "de la Paix", "de la Liberté", "de la Mairie",
    "de l'Église", "de la Gare", "de la Poste", "de l'École",
    "de la Forêt", "de la Mer", "de la Montagne", "de la Vallée",
    "de la Source", "du Moulin", "du Château", "de la Plage",
    "des Fleurs", "des Arbres", "des Oiseaux", "du Soleil",
    "du Vent", "de la Colline", "du Lac", "du Jardin",
    "Victor Hugo", "Jean Jaurès", "Charles de Gaulle", "Général Leclerc",
    "Pasteur", "Lamarck", "Voltaire", "Rousseau", "Molière",
    "de Paris", "de Lyon", "de Marseille", "de Bordeaux", "de Lille",
    "Grande Rue", "Petite Rue", "Rue Neuve", "Rue Verte", "Rue Blanche"
]

# French cities with different regions
CITIES = [
    # Major cities
    {"name": "Paris", "postcode": "75001", "department": "75", "region": "Île-de-France"},
    {"name": "Marseille", "postcode": "13001", "department": "13", "region": "Provence-Alpes-Côte d'Azur"},
    {"name": "Lyon", "postcode": "69001", "department": "69", "region": "Auvergne-Rhône-Alpes"},
    {"name": "Toulouse", "postcode": "31000", "department": "31", "region": "Occitanie"},
    {"name": "Nice", "postcode": "06000", "department": "06", "region": "Provence-Alpes-Côte d'Azur"},
    {"name": "Nantes", "postcode": "44000", "department": "44", "region": "Pays de la Loire"},
    {"name": "Strasbourg", "postcode": "67000", "department": "67", "region": "Grand Est"},
    {"name": "Montpellier", "postcode": "34000", "department": "34", "region": "Occitanie"},
    {"name": "Bordeaux", "postcode": "33000", "department": "33", "region": "Nouvelle-Aquitaine"},
    {"name": "Lille", "postcode": "59000", "department": "59", "region": "Hauts-de-France"},
    
    # Medium cities
    {"name": "Rennes", "postcode": "35000", "department": "35", "region": "Bretagne"},
    {"name": "Reims", "postcode": "51100", "department": "51", "region": "Grand Est"},
    {"name": "Le Havre", "postcode": "76600", "department": "76", "region": "Normandie"},
    {"name": "Saint-Étienne", "postcode": "42000", "department": "42", "region": "Auvergne-Rhône-Alpes"},
    {"name": "Toulon", "postcode": "83000", "department": "83", "region": "Provence-Alpes-Côte d'Azur"},
    {"name": "Grenoble", "postcode": "38000", "department": "38", "region": "Auvergne-Rhône-Alpes"},
    {"name": "Dijon", "postcode": "21000", "department": "21", "region": "Bourgogne-Franche-Comté"},
    {"name": "Angers", "postcode": "49000", "department": "49", "region": "Pays de la Loire"},
    {"name": "Villeurbanne", "postcode": "69100", "department": "69", "region": "Auvergne-Rhône-Alpes"},
    {"name": "Le Mans", "postcode": "72000", "department": "72", "region": "Pays de la Loire"},
    
    # Smaller cities and towns
    {"name": "Aix-en-Provence", "postcode": "13100", "department": "13", "region": "Provence-Alpes-Côte d'Azur"},
    {"name": "Brest", "postcode": "29200", "department": "29", "region": "Bretagne"},
    {"name": "Limoges", "postcode": "87000", "department": "87", "region": "Nouvelle-Aquitaine"},
    {"name": "Nîmes", "postcode": "30000", "department": "30", "region": "Occitanie"},
    {"name": "Clermont-Ferrand", "postcode": "63000", "department": "63", "region": "Auvergne-Rhône-Alpes"},
    {"name": "Tours", "postcode": "37000", "department": "37", "region": "Centre-Val de Loire"},
    {"name": "Amiens", "postcode": "80000", "department": "80", "region": "Hauts-de-France"},
    {"name": "Metz", "postcode": "57000", "department": "57", "region": "Grand Est"},
    {"name": "Besançon", "postcode": "25000", "department": "25", "region": "Bourgogne-Franche-Comté"},
    {"name": "Orléans", "postcode": "45000", "department": "45", "region": "Centre-Val de Loire"},
]

# France's spatial bounds from OS_FRANCE.fgb
FRANCE_BOUNDS = {
    'min_lon': -5.1413,
    'max_lon': 9.5600,
    'min_lat': 41.3336,
    'max_lat': 51.0892
}

def generate_random_coordinates_within_france() -> tuple:
    """Generate random coordinates within France's spatial extent"""
    latitude = random.uniform(FRANCE_BOUNDS['min_lat'], FRANCE_BOUNDS['max_lat'])
    longitude = random.uniform(FRANCE_BOUNDS['min_lon'], FRANCE_BOUNDS['max_lon'])
    return round(latitude, 6), round(longitude, 6)

def get_real_terrain_classification(latitude: float, longitude: float) -> Optional[Dict]:
    """Get real terrain classification with spatial extent breakdown"""
    if not DJANGO_AVAILABLE:
        # Fallback: return None if Django not available
        return None
    
    try:
        # Use the real terrain service which reads CLC Code_18 from OS_FRANCE.fgb
        terrain = terrain_service.get_terrain_type_at_coordinates(longitude, latitude)
        
        if terrain is None:
            return None
        
        # Get spatial extent breakdown for additional context
        gdf = terrain_service._load_land_use_data()
        extent_pct = terrain_service._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
        
        return {
            'terrain_type': terrain,
            'spatial_extent': extent_pct or {}
        }
    except Exception as e:
        print(f"Error getting terrain classification for ({latitude}, {longitude}): {e}")
        return None

def generate_building_address() -> Optional[Dict]:
    """Generate a single building-level address with real terrain classification"""
    max_attempts = 50  # Prevent infinite loop
    
    for attempt in range(max_attempts):
        # Generate random coordinates within France's spatial extent
        latitude, longitude = generate_random_coordinates_within_france()
        
        # Get real terrain classification from CLC data
        terrain_data = get_real_terrain_classification(latitude, longitude)
        
        # Only return if we got a valid terrain classification
        if terrain_data is not None:
            return {
                "lat_lng": f"{latitude}, {longitude}",
                "terrain_type": terrain_data['terrain_type'],
                "spatial_extent": terrain_data['spatial_extent']
            }
    
    # If we couldn't find valid terrain after many attempts, return None
    print(f"Warning: Could not find valid terrain classification after {max_attempts} attempts")
    return None

def generate_addresses(count: int = 100, include_target: bool = True) -> List[Dict]:
    """Generate multiple building addresses with real terrain classification"""
    addresses = []
    attempts = 0
    max_total_attempts = count * 10  # Allow more attempts for finding valid coordinates
    
    # Always include the target coordinate for validation
    if include_target:
        target_lat, target_lon = 45.953027, -0.503722
        target_terrain = get_real_terrain_classification(target_lat, target_lon)
        if target_terrain:
            addresses.append({
                "lat_lng": f"{target_lat}, {target_lon}",
                "terrain_type": target_terrain['terrain_type'],
                "spatial_extent": target_terrain['spatial_extent'],
                "note": "Target coordinate - should be IIIa"
            })
            print(f"✅ Included target coordinate: {target_terrain['terrain_type']} (expected IIIa)")
    
    # Generate remaining addresses
    while len(addresses) < count and attempts < max_total_attempts:
        address = generate_building_address()
        if address is not None:
            addresses.append(address)
        attempts += 1
    
    print(f"Generated {len(addresses)} valid addresses out of {count} requested (after {attempts} attempts)")
    return addresses

def batch_classify_coordinates(coordinates: List[Tuple[float, float]]) -> List[Dict]:
    """Batch classify multiple coordinates for better performance"""
    if not DJANGO_AVAILABLE:
        return []
    
    results = []
    gdf = terrain_service._load_land_use_data()  # Load once for batch processing
    
    for lat, lon in coordinates:
        try:
            terrain = terrain_service.get_terrain_type_at_coordinates(lon, lat)
            if terrain:
                extent_pct = terrain_service._calculate_spatial_extent_percentages(lon, lat, gdf, radius_km=2.0)
                results.append({
                    "lat_lng": f"{lat}, {lon}",
                    "terrain_type": terrain,
                    "spatial_extent": extent_pct or {}
                })
        except Exception as e:
            print(f"Error classifying ({lat}, {lon}): {e}")
    
    return results

def main():
    """Main function to generate and save addresses with enhanced features"""
    if not DJANGO_AVAILABLE:
        print("Error: Django environment not available. Cannot access terrain service.")
        print("Please ensure Django is properly configured and try again.")
        return
    
    print("🌍 Generating 100 spatially valid French building addresses with enhanced terrain classification...")
    print("✨ Using spatial extent-based classification for improved accuracy")
    
    addresses = generate_addresses(100, include_target=True)
    
    # Save to JSON file
    output_file = "building_addresses_enhanced_100_locations.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(addresses, f, ensure_ascii=False, indent=2)
    
    print(f"📁 Generated {len(addresses)} addresses and saved to {output_file}")
    
    # Show terrain distribution
    terrain_counts = {}
    for addr in addresses:
        terrain = addr['terrain_type']
        terrain_counts[terrain] = terrain_counts.get(terrain, 0) + 1
    
    print(f"\n📊 Terrain distribution:")
    terrain_descriptions = {
        '0': 'Water/Coastal',
        'II': 'Open Countryside', 
        'IIIa': 'Campaign with Obstacles',
        'IIIb': 'Urbanized/Industrial',
        'IV': 'Dense Urban'
    }
    
    for terrain, count in sorted(terrain_counts.items()):
        desc = terrain_descriptions.get(terrain, 'Unknown')
        print(f"  {terrain} ({desc}): {count} locations")
    
    # Validate target coordinate
    target_addr = next((addr for addr in addresses if 'note' in addr), None)
    if target_addr:
        expected = 'IIIa'
        actual = target_addr['terrain_type']
        status = '✅ PASS' if actual == expected else '❌ FAIL'
        print(f"\n🎯 Target coordinate validation:")
        print(f"  {status} {target_addr['lat_lng']}: {actual} (expected {expected})")
        
        # Show spatial extent for target coordinate
        extent = target_addr['spatial_extent']
        print(f"  Spatial extent breakdown:")
        for category, pct in sorted(extent.items()):
            print(f"    {category}: {pct:.1f}%")
    
    # Show detailed examples
    print(f"\n📍 Example addresses with spatial extent:")
    for i, addr in enumerate(addresses[:3]):
        print(f"{i+1}. {addr['lat_lng']}")
        print(f"   Terrain: {addr['terrain_type']} ({terrain_descriptions.get(addr['terrain_type'], 'Unknown')})")
        if 'note' in addr:
            print(f"   Note: {addr['note']}")
        
        # Show top 3 spatial extent categories
        extent = addr['spatial_extent']
        top_categories = sorted(extent.items(), key=lambda x: x[1], reverse=True)[:3]
        extent_str = ", ".join([f"{cat}: {pct:.1f}%" for cat, pct in top_categories])
        print(f"   Spatial extent: {extent_str}")
        print()
    
    print(f"✨ Enhanced terrain classification complete!")
    print(f"🔬 All classifications use spatial extent analysis for improved accuracy")

if __name__ == "__main__":
    main()
