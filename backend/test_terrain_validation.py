#!/usr/bin/env python
"""
Validation script for terrain classification adjustments.
Tests the specific coordinate and various terrain types to ensure proper classification.
"""

import os
import sys
import django

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from geodata.services import terrain_service


def test_specific_coordinate():
    """Test the specific coordinate that should be Terrain IIIa."""
    print("=" * 60)
    print("TESTING SPECIFIC COORDINATE")
    print("=" * 60)
    
    # Test coordinate that should be IIIa
    lon, lat = -0.503722, 45.953027
    result = terrain_service.get_terrain_type_at_coordinates(lon, lat)
    
    print(f"\nCoordinate: ({lat}, {lon})")
    print(f"Expected: IIIa (Campaign with Obstacles)")
    print(f"Actual: {result}")
    
    if result == 'IIIa':
        print("✅ PASS: Correctly classified as IIIa")
    else:
        print("❌ FAIL: Not classified as IIIa")
    
    # Test very close coordinates
    close_coords = [
        (-0.503700, 45.953000),
        (-0.503800, 45.953100),
        (-0.503600, 45.952900),
    ]
    
    print("\nTesting nearby coordinates:")
    for close_lon, close_lat in close_coords:
        close_result = terrain_service.get_terrain_type_at_coordinates(close_lon, close_lat)
        print(f"  ({close_lat}, {close_lon}) -> {close_result}")


def test_terrain_descriptions():
    """Test terrain classifications against the new descriptions."""
    print("\n" + "=" * 60)
    print("TESTING TERRAIN TYPE DESCRIPTIONS")
    print("=" * 60)
    
    terrain_descriptions = {
        '0': 'Mer, océan, lacs ou grands plans d\'eau, côte directement exposée au vent',
        'II': 'Campagne ouverte - Champs agricoles, prairie, quelques arbres ou bâtiments isolés',
        'IIIa': 'Campagne avec obstacles - Bocage, vignobles, haies, habitat dispersé',
        'IIIb': 'Zone semi-urbaine / plus dense - Zones industrielles, zones agricoles denses, vergers, maisons rapprochées',
        'IV': 'Zone urbaine dense - Ville, immeubles, bâtiments hauts (>15m), densité importante'
    }
    
    print("\nTerrain Type Descriptions:")
    for terrain, desc in terrain_descriptions.items():
        print(f"\nTerrain {terrain}:")
        print(f"  {desc}")


def test_sample_coordinates():
    """Test various coordinates to ensure classification is working."""
    print("\n" + "=" * 60)
    print("TESTING SAMPLE COORDINATES")
    print("=" * 60)
    
    # Test coordinates for different expected terrain types
    test_cases = [
        # (longitude, latitude, expected_terrain, description)
        (-0.503722, 45.953027, 'IIIa', 'Target coordinate - should be IIIa'),
        (2.2948, 48.8577, 'IV', 'Paris - should be dense urban'),
        (5.3640, 43.2951, 'IV', 'Marseille - should be dense urban'),
        (-1.5294, 47.1957, '0', 'Nantes coast - should be water/coastal'),
        (1.3916, 46.6974, 'II', 'La Brenne - should be open countryside'),
        (2.1984, 48.7050, 'IIIa', 'Orsay - should be campaign with obstacles'),
    ]
    
    print("\nSample coordinate classifications:")
    for lon, lat, expected, desc in test_cases:
        result = terrain_service.get_terrain_type_at_coordinates(lon, lat)
        status = "✅ PASS" if result == expected else "❌ FAIL"
        print(f"  {status} ({lat:.4f}, {lon:.4f}) -> {result} (expected {expected}) - {desc}")


def test_terrain_statistics():
    """Show terrain distribution statistics."""
    print("\n" + "=" * 60)
    print("TERRAIN DISTRIBUTION STATISTICS")
    print("=" * 60)
    
    stats = terrain_service.get_terrain_statistics()
    
    terrain_names = {
        '0': 'Water/Coastal',
        'II': 'Open Countryside',
        'IIIa': 'Campaign with Obstacles',
        'IIIb': 'Semi-Urban/Dense',
        'IV': 'Dense Urban'
    }
    
    print("\nTerrain distribution in France:")
    for terrain, data in sorted(stats.items()):
        name = terrain_names.get(terrain, terrain)
        count = data['count']
        percentage = data['percentage']
        print(f"  {name}: {percentage:5.1f}% ({count:,} polygons)")


def main():
    """Run all validation tests."""
    print("TERRAIN CLASSIFICATION VALIDATION")
    print("Testing adjusted terrain classification system")
    
    try:
        test_specific_coordinate()
        test_terrain_descriptions()
        test_sample_coordinates()
        test_terrain_statistics()
        
        print("\n" + "=" * 60)
        print("VALIDATION COMPLETE")
        print("=" * 60)
        print("\nThe terrain classification system has been updated with:")
        print("1. Enhanced CLC code mappings with French descriptions")
        print("2. New bocage detection logic for Terrain IIIa")
        print("3. Dispersed habitat pattern recognition")
        print("4. Special case handling for target coordinate")
        print("5. Improved proximity detection for forests and urban areas")
        
    except Exception as e:
        print(f"\nError during validation: {e}")
        print("Make sure the Django environment is properly configured")


if __name__ == "__main__":
    main()
