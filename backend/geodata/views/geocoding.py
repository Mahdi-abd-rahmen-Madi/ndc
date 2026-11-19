"""Geocoding search & reverse-geocoding ViewSet."""
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from geodata.services_address import address_service

MAX_GEOCODING_LIMIT = 50


class GeocodingSearchViewSet(viewsets.ViewSet):
    """ViewSet for geocoding search functionality."""

    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        try:
            limit = max(1, min(int(request.query_params.get('limit', 5)), MAX_GEOCODING_LIMIT))
        except (TypeError, ValueError):
            limit = 5
        terrain_type = request.query_params.get('terrain_type', None)

        if not query:
            return Response({'error': 'Search query parameter "q" is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if terrain_type and terrain_type in address_service.terrain_search_terms:
                addresses = address_service.get_random_addresses(limit, terrain_type)
                addresses = [
                    addr for addr in addresses
                    if query.lower() in addr.get('city', '').lower()
                    or query.lower() in addr.get('label', '').lower()
                ]
            else:
                raw_addresses = address_service.search_addresses(query, limit=min(max(limit, 15), MAX_GEOCODING_LIMIT))
                exact_addresses = [a for a in raw_addresses if a.get('properties', {}).get('type') == 'housenumber']
                other_addresses = [a for a in raw_addresses if a.get('properties', {}).get('type') != 'housenumber']
                selected = (exact_addresses + other_addresses)[:limit]

                formatted_addresses = []
                for addr in selected:
                    props = addr.get('properties', {})
                    coords = addr.get('geometry', {}).get('coordinates', [])
                    if len(coords) == 2:
                        formatted_addresses.append({
                            'label': props.get('label', ''),
                            'name': props.get('name', ''),
                            'postcode': props.get('postcode', ''),
                            'city': props.get('city', ''),
                            'context': props.get('context', ''),
                            'type': props.get('type', ''),
                            'importance': props.get('importance', 0),
                            'longitude': coords[0],
                            'latitude': coords[1],
                            'target_terrain': None,
                        })
                addresses = formatted_addresses

            return Response({
                'results': addresses,
                'count': len(addresses),
                'query': query,
                'terrain_type': terrain_type,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def terrain_types(self, request):
        return Response({
            'terrain_types': {
                '0': 'Water/coastal areas',
                'II': 'Open countryside',
                'IIIa': 'Campaign with obstacles',
                'IIIb': 'Urbanized/industrial',
                'IV': 'Dense urban',
            }
        })

    @action(detail=False, methods=['get'])
    def random_addresses(self, request):
        try:
            count = max(1, min(int(request.query_params.get('count', 10)), MAX_GEOCODING_LIMIT))
        except (TypeError, ValueError):
            count = 10
        terrain_type = request.query_params.get('terrain_type', None)

        try:
            addresses = address_service.get_random_addresses(count, terrain_type)
            return Response({
                'results': addresses,
                'count': len(addresses),
                'terrain_type': terrain_type,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def reverse(self, request):
        try:
            lon_raw = request.query_params.get('longitude')
            if lon_raw is None:
                lon_raw = request.query_params.get('lon')
            lat_raw = request.query_params.get('latitude')
            if lat_raw is None:
                lat_raw = request.query_params.get('lat')
            longitude = float(lon_raw)
            latitude = float(lat_raw)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Both longitude and latitude query parameters are required and must be valid floats'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            address = address_service.get_address_by_coordinates(longitude, latitude)
            if address:
                props = address.get('properties', {})
                coords = address.get('geometry', {}).get('coordinates', [])
                return Response({
                    'label': props.get('label', ''),
                    'name': props.get('name', ''),
                    'postcode': props.get('postcode', ''),
                    'city': props.get('city', ''),
                    'context': props.get('context', ''),
                    'type': props.get('type', ''),
                    'importance': props.get('importance', 0),
                    'longitude': coords[0] if len(coords) == 2 else longitude,
                    'latitude': coords[1] if len(coords) == 2 else latitude,
                })
            return Response({'error': 'No address found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

