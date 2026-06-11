from django.shortcuts import render
from rest_framework import viewsets, filters, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import cache_page
from django.conf import settings
import json
import os
import requests
from .models import AntennaEquipment, AntennaSpecification, TerrainLoadCalculation, AntennaEquipmentHistory, HeightCalculationRequest, Notification
from api.permissions import IsAdminOrEngineerPermission, IsAdminOrResponsibleEngineerPermission
from .serializers import (
    AntennaEquipmentSerializer, AntennaEquipmentListSerializer,
    AntennaSpecificationSerializer, TerrainLoadCalculationSerializer,
    AntennaEquipmentHistorySerializer,
    HeightCalculationRequestSerializer, HeightCalculationRequestAdminSerializer,
    NotificationSerializer
)
from .services import terrain_service
from .services_address import address_service
from .services import TerrainClassificationService
from .terrain_config_service import terrain_config_service


class AntennaEquipmentViewSet(viewsets.ModelViewSet):
    """ViewSet for AntennaEquipment model"""
    permission_classes = [IsAdminOrEngineerPermission]
    queryset = AntennaEquipment.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['region', 'status']
    search_fields = ['name', 'responsible_person', 'sub_elements', 'item_id']
    ordering_fields = ['name', 'created_at', 'building_height', 'mast_height']
    ordering = ['name']

    def get_queryset(self):
        """
        Filter queryset based on user role and responsibility.
        Admins see all equipment, engineers see only equipment they're responsible for.
        Supports ?include_deleted=true to include soft-deleted items (trash bin view).
        Public list access returns all non‑deleted equipment.
        """
        user = self.request.user
        include_deleted = self.request.query_params.get('include_deleted', 'false').lower() == 'true'
        only_deleted = self.request.query_params.get('only_deleted', 'false').lower() == 'true'

        # Public read‑only list – no user filtering
        if self.action == 'list' and not user.is_authenticated:
            qs = AntennaEquipment.objects.all()
        elif user.is_staff or user.is_superuser:
            qs = AntennaEquipment.objects.all()
        else:
            qs = AntennaEquipment.objects.filter(responsible_user=user)

        if only_deleted:
            return qs.filter(is_deleted=True)
        elif not include_deleted:
            return qs.filter(is_deleted=False)
        return qs

    def get_permissions(self):
        """
        Custom permissions for different actions.
        """
        if self.action in ['list', 'public_lookup']:
            # Public read‑only access for catalogue list and public lookup
            self.permission_classes = [permissions.AllowAny]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # For update/delete, check if user is responsible for this specific equipment
            self.permission_classes = [IsAdminOrResponsibleEngineerPermission]
        else:
            # For retrieve/create and other actions, require admin or engineer
            self.permission_classes = [IsAdminOrEngineerPermission]

        return super().get_permissions()

    def perform_create(self, serializer):
        """
        When engineers create equipment, automatically assign them as responsible.
        Also creates the first history snapshot.
        """
        # If user is an engineer, assign them as responsible user
        if hasattr(self.request.user, 'engineer_profile'):
            instance = serializer.save(responsible_user=self.request.user)
        else:
            # Admins can specify responsible user or leave it null
            instance = serializer.save()
        
        # Record creation history
        AntennaEquipmentHistory.objects.create(
            equipment=instance,
            user=self.request.user,
            action='CREATE',
            snapshot=instance.create_snapshot(),
        )

    def perform_update(self, serializer):
        """
        Snapshot the current state before applying updates.
        """
        instance = serializer.instance
        # Create snapshot of the state before update
        AntennaEquipmentHistory.objects.create(
            equipment=instance,
            user=self.request.user,
            action='UPDATE',
            snapshot=instance.create_snapshot(),
        )
        serializer.save()

    def perform_destroy(self, instance):
        """
        Override destroy to do soft-delete instead of hard-delete.
        """
        AntennaEquipmentHistory.objects.create(
            equipment=instance,
            user=self.request.user,
            action='DELETE',
            snapshot=instance.create_snapshot(),
        )
        instance.is_deleted = True
        instance.save()

    def get_serializer_class(self):
        if self.action == 'list':
            return AntennaEquipmentListSerializer
        return AntennaEquipmentSerializer

    @action(detail=True, methods=['get'])
    def specifications(self, request, pk=None):
        """Get all specifications for this equipment"""
        equipment = self.get_object()
        specifications = equipment.specifications.all()
        serializer = AntennaSpecificationSerializer(specifications, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def terrain_calculations(self, request, pk=None):
        """Get all terrain calculations for this equipment"""
        equipment = self.get_object()
        calculations = equipment.terrain_calculations.all()
        serializer = TerrainLoadCalculationSerializer(calculations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def terrain_type(self, request, pk=None):
        """Determine terrain type for this equipment based on location"""
        equipment = self.get_object()
        
        # Check if equipment has coordinates
        if not hasattr(equipment, 'longitude') or not hasattr(equipment, 'latitude'):
            return Response(
                {'error': 'Equipment must have longitude and latitude coordinates'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            terrain_type = terrain_service.get_terrain_type_for_equipment(equipment)
            if terrain_type:
                return Response({
                    'terrain_type': terrain_type,
                    'coordinates': {
                        'longitude': float(equipment.longitude),
                        'latitude': float(equipment.latitude)
                    }
                })
            else:
                return Response(
                    {'error': 'No terrain classification found at these coordinates'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # --- Version History & Rollback Endpoints ---

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get the full version history for this equipment"""
        equipment = self.get_object()
        history = equipment.history.all().order_by('-changed_at')
        serializer = AntennaEquipmentHistorySerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='restore/(?P<history_id>[0-9]+)')
    def restore_version(self, request, pk=None, history_id=None):
        """Restore equipment to a specific version from history"""
        equipment = self.get_object()
        try:
            history_entry = AntennaEquipmentHistory.objects.get(
                id=history_id, equipment=equipment
            )
        except AntennaEquipmentHistory.DoesNotExist:
            return Response(
                {'error': 'Version introuvable'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Record current state before restoring
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='RESTORE',
            snapshot=equipment.create_snapshot(),
        )

        equipment.restore_snapshot(history_entry.snapshot)
        serializer = AntennaEquipmentSerializer(equipment)
        return Response(serializer.data)

    # --- Soft Delete / Trash Endpoints ---

    @action(detail=True, methods=['post'])
    def soft_delete(self, request, pk=None):
        """Soft-delete equipment (move to trash)"""
        equipment = self.get_object()
        if equipment.is_deleted:
            return Response(
                {'error': 'Cet équipement est déjà supprimé'},
                status=status.HTTP_400_BAD_REQUEST
            )
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='DELETE',
            snapshot=equipment.create_snapshot(),
        )
        equipment.is_deleted = True
        equipment.save()
        return Response({'status': 'Déplacé vers la corbeille'})

    @action(detail=True, methods=['post'])
    def undelete(self, request, pk=None):
        """Restore a soft-deleted equipment from trash"""
        equipment = self.get_object()
        if not equipment.is_deleted:
            return Response(
                {'error': "Cet équipement n'est pas supprimé"},
                status=status.HTTP_400_BAD_REQUEST
            )
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='RESTORE',
            snapshot=equipment.create_snapshot(),
        )
        equipment.is_deleted = False
        equipment.save()
        return Response({'status': 'Restauré depuis la corbeille'})

    @action(detail=True, methods=['delete'])
    def permanent_delete(self, request, pk=None):
        """Permanently delete equipment (admin only)"""
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(
                {'error': 'Seuls les administrateurs peuvent supprimer définitivement'},
                status=status.HTTP_403_FORBIDDEN
            )
        equipment = self.get_object()
        equipment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- File Management Endpoints ---

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_file(self, request, pk=None):
        """Upload a document file for this equipment's montage folder"""
        equipment = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'error': 'Aucun fichier fourni'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine the montage folder name from equipment name
        montage_name = equipment.name.lower().replace(' ', '_')
        catalogue_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue', montage_name)
        os.makedirs(catalogue_dir, exist_ok=True)

        file_path = os.path.join(catalogue_dir, file_obj.name)
        with open(file_path, 'wb+') as dest:
            for chunk in file_obj.chunks():
                dest.write(chunk)

        # Record snapshot after file upload
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='UPDATE',
            snapshot=equipment.create_snapshot(),
        )

        return Response({
            'status': 'Fichier téléversé',
            'filename': file_obj.name,
            'path': f'/media/catalogue/{montage_name}/{file_obj.name}',
        })

    @action(detail=True, methods=['get'])
    def list_files(self, request, pk=None):
        """List all document files in this equipment's catalogue folder and terrain folders"""
        equipment = self.get_object()
        montage_name = equipment.name.lower().replace(' ', '_')
        safe_item_id = (equipment.item_id or str(equipment.id)).replace(' ', '_').lower()
        
        manual_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue', montage_name)
        terrain_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue', 'terrain', safe_item_id)

        files = []
        
        # 1. Scan manual uploads directory recursively
        if os.path.isdir(manual_dir):
            for root, _, filenames in os.walk(manual_dir):
                for entry in filenames:
                    entry_path = os.path.join(root, entry)
                    if os.path.isfile(entry_path):
                        rel_path = os.path.relpath(entry_path, settings.MEDIA_ROOT)
                        files.append({
                            'name': entry,
                            'size': os.path.getsize(entry_path),
                            'url': f'/media/{rel_path}',
                            'source': 'Manual',
                            'category': 'uploaded',
                            'rel_path': os.path.relpath(entry_path, manual_dir)
                        })

        # 2. Scan terrain documents directory recursively
        if os.path.isdir(terrain_dir):
            for root, _, filenames in os.walk(terrain_dir):
                for entry in filenames:
                    entry_path = os.path.join(root, entry)
                    if os.path.isfile(entry_path):
                        rel_path = os.path.relpath(entry_path, settings.MEDIA_ROOT)
                        # Extract terrain_type, region, height from the relative path structure:
                        # terrain/{safe_item_id}/{terrain_type}/{region}/{height_folder}/{filename}
                        rel_parts = os.path.relpath(root, terrain_dir).split(os.sep)
                        terrain_type = rel_parts[0] if len(rel_parts) > 0 else 'Inconnu'
                        region = rel_parts[1] if len(rel_parts) > 1 else 'Inconnu'
                        height = rel_parts[2] if len(rel_parts) > 2 else 'Inconnu'
                        
                        files.append({
                            'name': entry,
                            'size': os.path.getsize(entry_path),
                            'url': f'/media/{rel_path}',
                            'source': 'Monday / Terrain',
                            'category': 'terrain',
                            'terrain_type': terrain_type,
                            'region': region,
                            'height': height,
                            'rel_path': os.path.join('terrain', os.path.relpath(entry_path, terrain_dir))
                        })

        return Response(files)

    @action(detail=True, methods=['delete'], url_path='delete_file/(?P<filename>.+)')
    def delete_file(self, request, pk=None, filename=None):
        """Delete a specific file from the equipment's catalogue or terrain folder"""
        equipment = self.get_object()
        montage_name = equipment.name.lower().replace(' ', '_')
        safe_item_id = (equipment.item_id or str(equipment.id)).replace(' ', '_').lower()

        # Build paths
        manual_dir = os.path.abspath(os.path.join(settings.MEDIA_ROOT, 'catalogue', montage_name))
        terrain_dir = os.path.abspath(os.path.join(settings.MEDIA_ROOT, 'catalogue', 'terrain', safe_item_id))

        # Check if filename is trying to access files in terrain or manual
        if filename.startswith('terrain/'):
            # It's a terrain file deletion
            sub_path = filename[len('terrain/'):]
            target_path = os.path.abspath(os.path.join(terrain_dir, sub_path))
            allowed_dir = terrain_dir
        else:
            # It's a manual upload deletion
            target_path = os.path.abspath(os.path.join(manual_dir, filename))
            allowed_dir = manual_dir

        # Security check to prevent directory traversal
        if not target_path.startswith(allowed_dir) or not os.path.isfile(target_path):
            return Response(
                {'error': 'Fichier introuvable ou accès refusé'},
                status=status.HTTP_404_NOT_FOUND
            )

        os.remove(target_path)

        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='UPDATE',
            snapshot=equipment.create_snapshot(),
        )

        return Response({'status': 'Fichier supprimé'})

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def public_lookup(self, request):
        """
        Public lookup for antenna equipment based on coordinates (address geocoding) and height.
        """
        latitude = request.query_params.get('latitude')
        longitude = request.query_params.get('longitude')
        mast_height = request.query_params.get('mast_height')
        building_height = request.query_params.get('building_height')

        if not latitude or not longitude:
            return Response(
                {'error': 'Both latitude and longitude parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat = float(latitude)
            lon = float(longitude)
        except ValueError:
            return Response(
                {'error': 'Invalid coordinate format'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Determine terrain type at coordinates
        terrain_type = None
        try:
            # Import dynamically to prevent circular imports if any
            from .services import TerrainClassificationService
            ts = TerrainClassificationService.get_instance()
            terrain_type = ts.get_terrain_type_at_coordinates(lon, lat)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error classifying terrain for public lookup: {e}")

        # 2. Determine region at coordinates
        region_number = None
        try:
            from .services import TerrainClassificationService
            ts = TerrainClassificationService.get_instance()
            region_number = ts.get_region_from_coordinates(lon, lat)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error getting region for public lookup: {e}")

        # Query AntennaEquipment — exclude soft-deleted
        queryset = AntennaEquipment.objects.filter(is_deleted=False)

        if region_number:
            queryset = queryset.filter(region=region_number)
        
        if mast_height:
            try:
                queryset = queryset.filter(mast_height=float(mast_height))
            except ValueError:
                pass

        if building_height:
            try:
                queryset = queryset.filter(building_height=float(building_height))
            except ValueError:
                pass

        montage = request.query_params.get('montage')
        if montage:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(name__iexact=f"Montage {montage}") |
                Q(name__istartswith=f"Montage {montage}.")
            )

        # Serialize results
        serializer = AntennaEquipmentSerializer(queryset, many=True)

        return Response({
            'detected_terrain_type': terrain_type,
            'detected_region': region_number,
            'equipment': serializer.data
        })



class AntennaSpecificationViewSet(viewsets.ModelViewSet):
    """ViewSet for AntennaSpecification model"""
    permission_classes = [IsAdminOrEngineerPermission]
    serializer_class = AntennaSpecificationSerializer
    queryset = AntennaSpecification.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['antenna_type', 'equipment']
    search_fields = ['equipment__name', 'antenna_type']

    def get_queryset(self):
        """
        Filter queryset based on user role and equipment responsibility.
        Admins see all specifications, engineers see only specifications for their equipment.
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return AntennaSpecification.objects.all()
        
        # Engineers see only specifications for equipment they're responsible for
        return AntennaSpecification.objects.filter(equipment__responsible_user=user)

    def get_permissions(self):
        """
        Custom permissions for different actions.
        """
        if self.action in ['update', 'partial_update', 'destroy']:
            # For update/delete, check if user is responsible for the equipment
            self.permission_classes = [IsAdminOrResponsibleEngineerPermission]
        else:
            # For list/retrieve/create, allow admins and engineers
            self.permission_classes = [IsAdminOrEngineerPermission]
        
        return super().get_permissions()

    def perform_create(self, serializer):
        """
        Validate and create specifications with RBAC checks.
        """
        equipment = serializer.validated_data['equipment']
        antenna_type = serializer.validated_data['antenna_type']
        
        # If user is an engineer, check if they're responsible for this equipment
        if hasattr(self.request.user, 'engineer_profile'):
            if equipment.responsible_user != self.request.user:
                raise serializers.ValidationError(
                    "You can only create specifications for equipment you are responsible for."
                )
        
        # Validate that equipment doesn't already have this antenna type
        if AntennaSpecification.objects.filter(
            equipment=equipment, 
            antenna_type=antenna_type
        ).exists():
            raise serializers.ValidationError({
                'antenna_type': 'This equipment already has a specification for this antenna type.'
            })
        
        serializer.save()

    ordering_fields = ['equipment__name', 'antenna_type', 'height_mm', 'width_mm']
    ordering = ['equipment__name', 'antenna_type']


class TerrainClassificationViewSet(viewsets.ViewSet):
    """ViewSet for terrain classification services"""
    permission_classes = [IsAdminOrEngineerPermission]
    
    @action(detail=False, methods=['get'])
    def classify_coordinates(self, request):
        """Classify terrain type at specific coordinates"""
        longitude = request.query_params.get('longitude')
        latitude = request.query_params.get('latitude')
        
        if not longitude or not latitude:
            return Response(
                {'error': 'Both longitude and latitude parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            lon = float(longitude)
            lat = float(latitude)
            
            # Validate coordinate ranges
            if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
                return Response(
                    {'error': 'Invalid coordinate ranges'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            terrain_type = terrain_service.get_terrain_type_at_coordinates(lon, lat)
            
            if terrain_type:
                return Response({
                    'terrain_type': terrain_type,
                    'coordinates': {'longitude': lon, 'latitude': lat}
                })
            else:
                return Response(
                    {'error': 'No terrain classification found at these coordinates'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except ValueError:
            return Response(
                {'error': 'Invalid coordinate format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def batch_classify(self, request):
        """Classify terrain types for multiple coordinates"""
        coordinates = request.data if request.method == 'POST' else request.query_params
        
        if 'coordinates' not in coordinates:
            return Response(
                {'error': 'coordinates parameter is required (list of [longitude, latitude] pairs)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            coords_list = coordinates['coordinates']
            if not isinstance(coords_list, list):
                raise ValueError('coordinates must be a list')
            
            results = []
            for i, coord_pair in enumerate(coords_list):
                if not isinstance(coord_pair, list) or len(coord_pair) != 2:
                    return Response(
                        {'error': f'Invalid coordinate format at index {i}. Expected [longitude, latitude]'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                lon, lat = coord_pair
                terrain_type = terrain_service.get_terrain_type_at_coordinates(float(lon), float(lat))
                results.append({
                    'coordinates': {'longitude': lon, 'latitude': lat},
                    'terrain_type': terrain_type
                })
            
            return Response({'results': results})
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get terrain type distribution statistics"""
        try:
            stats = terrain_service.get_terrain_statistics()
            return Response(stats)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def mappings(self, request):
        """Get all terrain type mappings"""
        try:
            mappings = AntennaEquipment.get_all_terrain_mappings()
            return Response(mappings)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TerrainConfigViewSet(viewsets.ViewSet):
    """ViewSet for terrain configuration management"""
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def config(self, request):
        """Get current terrain configuration"""
        try:
            config = terrain_config_service.load_config()
            return Response(config)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get configuration summary"""
        try:
            summary = terrain_config_service.get_config_summary()
            return Response(summary)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def clc_mappings(self, request):
        """Get CLC code to terrain mappings"""
        try:
            mappings = terrain_config_service.get_clc_code_mappings()
            return Response(mappings)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def classification_rules(self, request):
        """Get classification rules"""
        try:
            rules = terrain_config_service.get_classification_rules()
            return Response(rules)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def spatial_analysis(self, request):
        """Get spatial analysis configuration"""
        try:
            spatial_config = terrain_config_service.get_spatial_analysis_config()
            return Response(spatial_config)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def influence_percentages(self, request):
        """Get influence percentages"""
        try:
            influence = terrain_config_service.get_influence_percentages()
            return Response(influence)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def update_config(self, request):
        """Update terrain configuration"""
        try:
            new_config = request.data
            success = terrain_config_service.update_config(new_config)
            
            if success:
                return Response({
                    'message': 'Configuration updated successfully',
                    'config': terrain_config_service.load_config()
                })
            else:
                return Response(
                    {'error': 'Failed to update configuration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def reset(self, request):
        """Reset configuration to defaults"""
        try:
            success = terrain_config_service.reset_to_defaults()
            
            if success:
                return Response({
                    'message': 'Configuration reset successfully',
                    'config': terrain_config_service.load_config()
                })
            else:
                return Response(
                    {'error': 'Failed to reset configuration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def export(self, request):
        """Export configuration as JSON"""
        try:
            config_json = terrain_config_service.export_config()
            return Response({
                'config': config_json,
                'filename': 'terrain_config.json'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def import_config(self, request):
        """Import configuration from JSON"""
        try:
            config_json = request.data.get('config', '')
            if not config_json:
                return Response(
                    {'error': 'Configuration JSON is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            success = terrain_config_service.import_config(config_json)
            
            if success:
                return Response({
                    'message': 'Configuration imported successfully',
                    'config': terrain_config_service.load_config()
                })
            else:
                return Response(
                    {'error': 'Failed to import configuration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def test_coordinates(self, request):
        """Test coordinates with current configuration"""
        try:
            longitude = float(request.data.get('longitude'))
            latitude = float(request.data.get('latitude'))
            analysis_radius_km = request.data.get('analysis_radius_km')
            
            if analysis_radius_km is not None:
                analysis_radius_km = float(analysis_radius_km)
            else:
                analysis_radius_km = 1.0
            
            from .services import TerrainClassificationService
            terrain_service = TerrainClassificationService.get_instance()
            
            # Get detailed terrain classification information
            classification_details = terrain_service.get_terrain_classification_details(longitude, latitude)
            
            # Get region from coordinates
            region = terrain_service.get_region_from_coordinates(longitude, latitude)
            
            # Get spatial extent (using cached data if available)
            gdf = terrain_service._load_land_use_data()
            spatial_extent = terrain_service._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=analysis_radius_km)
            
            # Extract intersecting CLC polygons for visualization
            from shapely.geometry import Point
            import math
            
            point = Point(longitude, latitude)
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            radius_deg_lat = analysis_radius_km / km_per_deg_lat
            
            search_area = point.buffer(radius_deg_lat)
            intersects = gdf[gdf.geometry.intersects(search_area)]
            
            if len(intersects) > 0:
                # Select only the relevant fields to keep payload small
                simplified_gdf = intersects[['Code_18', 'geometry']].copy()
                clc_geojson = json.loads(simplified_gdf.to_json())
            else:
                clc_geojson = {"type": "FeatureCollection", "features": []}
            
            # Calculate transition zones (50m buffer of Terrain II/IIIa intersecting Terrain IV/IIIb)
            transition_geojson = {"type": "FeatureCollection", "features": []}
            if len(intersects) > 0:
                try:
                    # Project to EPSG:2154 for metric operations
                    intersects_projected = intersects.to_crs(epsg=2154)
                    
                    # Get CLC mappings
                    clc_mappings = terrain_config_service.get_clc_code_mappings()
                    terrain_II_codes = clc_mappings.get('terrain_II', {}).get('codes', [])
                    terrain_IIIa_codes = clc_mappings.get('terrain_IIIa', {}).get('codes', [])
                    target_codes = list(terrain_II_codes) + list(terrain_IIIa_codes)
                    
                    terrain_IV_codes = clc_mappings.get('terrain_IV', {}).get('codes', [])
                    terrain_IIIb_codes = clc_mappings.get('terrain_IIIb', {}).get('codes', [])
                    urban_codes = list(terrain_IV_codes) + list(terrain_IIIb_codes)
                    
                    urban_polygons = intersects_projected[intersects_projected['Code_18'].isin(urban_codes)]
                    target_polygons = intersects_projected[intersects_projected['Code_18'].isin(target_codes)]
                    
                    if len(urban_polygons) > 0 and len(target_polygons) > 0:
                        # Buffer target polygons by 50m
                        buffered_targets = target_polygons.geometry.buffer(50.0).unary_union
                        # Intersect with urban polygons to find transition zones
                        transition_zones = urban_polygons.geometry.intersection(buffered_targets)
                        
                        import geopandas as gpd
                        transition_gdf = gpd.GeoDataFrame(geometry=transition_zones, crs="EPSG:2154").to_crs(epsg=4326)
                        transition_gdf = transition_gdf[~transition_gdf.geometry.is_empty]
                        
                        if len(transition_gdf) > 0:
                            # Keep only geometry and type for the payload
                            transition_gdf['type'] = 'transition_zone'
                            transition_geojson = json.loads(transition_gdf[['geometry', 'type']].to_json())
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error calculating transition zones for visualization: {e}")

            # Clean spatial extent data to handle np.float64 and nan values
            cleaned_spatial_extent = {}
            if spatial_extent:
                for key, value in spatial_extent.items():
                    if isinstance(value, (float, int)):
                        # Handle nan values and convert to regular Python float
                        if value != value:  # nan check
                            cleaned_spatial_extent[key] = 0.0
                        else:
                            cleaned_spatial_extent[key] = float(value)
                    else:
                        cleaned_spatial_extent[key] = value
            
            # Clean confidence score
            confidence_score = classification_details['confidence_score']
            if isinstance(confidence_score, (float, int)):
                if confidence_score != confidence_score:  # nan check
                    confidence_score = 0.0
                else:
                    confidence_score = float(confidence_score)
            
            return Response({
                'terrain_type': classification_details['terrain_type'],
                'base_terrain_type': classification_details['base_terrain_type'],
                'confidence_score': confidence_score,
                'detected_clc_codes': classification_details['detected_clc_codes'],
                'primary_clc_code': classification_details['primary_clc_code'],
                'region': {
                    'number': region,
                    'name': f"Region {region}" if region else "Unknown"
                },
                'coordinates': {
                    'longitude': float(longitude),
                    'latitude': float(latitude)
                },
                'spatial_extent': cleaned_spatial_extent,
                'applicable_rules': classification_details['applicable_rules'],
                'rule_explanations': classification_details['rule_explanations'],
                'clc_polygons': clc_geojson,
                'transition_zones': transition_geojson
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def performance_metrics(self, request):
        """Get performance metrics for monitoring."""
        try:
            metrics = terrain_service.get_performance_metrics()
            return Response(metrics)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def reset_metrics(self, request):
        """Reset performance metrics."""
        try:
            terrain_service.reset_performance_metrics()
            return Response({'message': 'Performance metrics reset successfully'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def clear_cache(self, request):
        """Clear terrain classification cache."""
        try:
            pattern = request.data.get('pattern')
            terrain_service.clear_cache(pattern)
            return Response({'message': 'Cache cleared successfully'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def optimize_memory(self, request):
        """Optimize memory usage."""
        try:
            terrain_service.optimize_memory_usage()
            return Response({'message': 'Memory optimization completed'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def edge_cases(self, request):
        """Get configuration edge cases and warnings."""
        try:
            config = terrain_config_service.load_config()
            edge_cases = terrain_config_service.detect_edge_cases(config)
            return Response({
                'edge_cases': edge_cases,
                'edge_case_count': len(edge_cases)
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def terrain_confidence(self, request):
        """Get confidence score for terrain classification at coordinates."""
        try:
            longitude = float(request.query_params.get('longitude'))
            latitude = float(request.query_params.get('latitude'))
            
            confidence = terrain_service.get_terrain_confidence(longitude, latitude)
            
            return Response({
                'coordinates': {
                    'longitude': longitude,
                    'latitude': latitude
                },
                'confidence_score': confidence
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class TerrainLoadCalculationViewSet(viewsets.ModelViewSet):
    """ViewSet for TerrainLoadCalculation model"""
    permission_classes = [IsAdminOrEngineerPermission]
    serializer_class = TerrainLoadCalculationSerializer
    queryset = TerrainLoadCalculation.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['terrain_type', 'equipment']
    search_fields = ['equipment__name', 'terrain_type', 'section_material']
    ordering_fields = ['equipment__name', 'terrain_type', 'created_at']
    ordering = ['equipment__name', 'terrain_type']

    def get_queryset(self):
        """
        Filter queryset based on user role and equipment responsibility.
        Admins see all calculations, engineers see only calculations for their equipment.
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return TerrainLoadCalculation.objects.all()
        
        # Engineers see only calculations for equipment they're responsible for
        return TerrainLoadCalculation.objects.filter(equipment__responsible_user=user)

    def get_permissions(self):
        """
        Custom permissions for different actions.
        """
        if self.action in ['update', 'partial_update', 'destroy']:
            # For update/delete, check if user is responsible for the equipment
            self.permission_classes = [IsAdminOrResponsibleEngineerPermission]
        else:
            # For list/retrieve/create, allow admins and engineers
            self.permission_classes = [IsAdminOrEngineerPermission]
        
        return super().get_permissions()

    def perform_create(self, serializer):
        """
        Validate and create terrain calculations with RBAC checks.
        """
        equipment = serializer.validated_data['equipment']
        terrain_type = serializer.validated_data['terrain_type']
        
        # If user is an engineer, check if they're responsible for this equipment
        if hasattr(self.request.user, 'engineer_profile'):
            if equipment.responsible_user != self.request.user:
                raise serializers.ValidationError(
                    "You can only create terrain calculations for equipment you are responsible for."
                )
        
        # Validate that equipment doesn't already have this terrain type
        if TerrainLoadCalculation.objects.filter(
            equipment=equipment, 
            terrain_type=terrain_type
        ).exists():
            raise serializers.ValidationError({
                'terrain_type': 'This equipment already has a calculation for this terrain type.'
            })
        
        serializer.save()


class GeocodingSearchViewSet(viewsets.ViewSet):
    """ViewSet for geocoding search functionality"""
    permission_classes = [permissions.AllowAny]  # Allow public access for frontend
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search for addresses using geocoding API"""
        query = request.query_params.get('q', '').strip()
        limit = int(request.query_params.get('limit', 5))
        terrain_type = request.query_params.get('terrain_type', None)
        
        if not query:
            return Response(
                {'error': 'Search query parameter "q" is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if terrain_type and terrain_type in address_service.terrain_search_terms:
                # Get addresses for specific terrain type
                addresses = address_service.get_random_addresses(limit, terrain_type)
                # Filter by search query if provided
                if query:
                    addresses = [
                        addr for addr in addresses 
                        if query.lower() in addr.get('city', '').lower() or 
                           query.lower() in addr.get('label', '').lower()
                    ]
            else:
                # Direct search using geocoding API
                addresses = address_service.search_addresses(query, limit)
                # Convert to frontend format
                formatted_addresses = []
                for addr in addresses:
                    props = addr.get('properties', {})
                    geometry = addr.get('geometry', {})
                    coordinates = geometry.get('coordinates', [])
                    
                    if len(coordinates) == 2:
                        formatted_addr = {
                            'label': props.get('label', ''),
                            'name': props.get('name', ''),
                            'postcode': props.get('postcode', ''),
                            'city': props.get('city', ''),
                            'context': props.get('context', ''),
                            'type': props.get('type', ''),
                            'importance': props.get('importance', 0),
                            'longitude': coordinates[0],
                            'latitude': coordinates[1],
                            'target_terrain': None
                        }
                        formatted_addresses.append(formatted_addr)
                
                addresses = formatted_addresses
            
            return Response({
                'results': addresses,
                'count': len(addresses),
                'query': query,
                'terrain_type': terrain_type
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def terrain_types(self, request):
        """Get available terrain types with descriptions"""
        terrain_descriptions = {
            '0': 'Water/coastal areas',
            'II': 'Open countryside',
            'IIIa': 'Campaign with obstacles',
            'IIIb': 'Urbanized/industrial',
            'IV': 'Dense urban'
        }
        
        return Response({
            'terrain_types': terrain_descriptions
        })
    
    @action(detail=False, methods=['get'])
    def random_addresses(self, request):
        """Get random addresses for testing"""
        count = int(request.query_params.get('count', 10))
        terrain_type = request.query_params.get('terrain_type', None)
        
        try:
            addresses = address_service.get_random_addresses(count, terrain_type)
            return Response({
                'results': addresses,
                'count': len(addresses),
                'terrain_type': terrain_type
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def reverse(self, request):
        """Reverse geocode coordinates using IGN API"""
        try:
            longitude = float(request.query_params.get('longitude') or request.query_params.get('lon'))
            latitude = float(request.query_params.get('latitude') or request.query_params.get('lat'))
        except (TypeError, ValueError):
            return Response(
                {'error': 'Both longitude and latitude query parameters are required and must be valid floats'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            address = address_service.get_address_by_coordinates(longitude, latitude)
            if address:
                props = address.get('properties', {})
                geometry = address.get('geometry', {})
                coordinates = geometry.get('coordinates', [])
                
                formatted_addr = {
                    'label': props.get('label', ''),
                    'name': props.get('name', ''),
                    'postcode': props.get('postcode', ''),
                    'city': props.get('city', ''),
                    'context': props.get('context', ''),
                    'type': props.get('type', ''),
                    'importance': props.get('importance', 0),
                    'longitude': coordinates[0] if len(coordinates) == 2 else longitude,
                    'latitude': coordinates[1] if len(coordinates) == 2 else latitude,
                }
                return Response(formatted_addr)
            else:
                return Response({'error': 'No address found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



def terrain_map_view(request):
    """Render the terrain classification map page"""
    return render(request, 'geodata/terrain_map.html')


def region_map_view(request):
    """Render the region visualization map page"""
    return render(request, 'geodata/region_map.html')


class RegionGeoJSONViewSet(viewsets.ViewSet):
    """ViewSet for serving region boundaries as GeoJSON"""
    permission_classes = [permissions.AllowAny]  # Allow public access for frontend
    
    @action(detail=False, methods=['get'])
    def regions(self, request):
        """Get all region boundaries as GeoJSON from actual wind coefficient data"""
        try:
            import json
            from collections import defaultdict
            from django.conf import settings
            import os
            
            # Load the actual GeoJSON file
            geojson_path = os.path.join(settings.BASE_DIR, 'backend', 'data', 'ec1_windCoeff.geojson')
            
            with open(geojson_path, 'r') as f:
                data = json.load(f)
            
            # Group features by V_B0 value (region)
            regions = defaultdict(list)
            region_mapping = {
                22: 1,  # Region 1
                24: 2,  # Region 2
                26: 3,  # Region 3
                28: 4   # Region 4
            }
            
            region_descriptions = {
                1: "Northern France (V_B0: 22)",
                2: "Western France (V_B0: 24)", 
                3: "Central France (V_B0: 26)",
                4: "Eastern France (V_B0: 28)"
            }
            
            # Group all geometries by their V_B0 value
            for feature in data.get('features', []):
                v_b0 = feature.get('properties', {}).get('V_B0')
                if v_b0 and v_b0 in region_mapping:
                    region_id = region_mapping[v_b0]
                    # Add the feature to the appropriate region
                    regions[region_id].append(feature.get('geometry'))
            
            # Create combined features for each region
            combined_features = []
            for region_id in [1, 2, 3, 4]:
                if region_id in regions and regions[region_id]:
                    # Combine all geometries for this region
                    combined_feature = {
                        "type": "Feature",
                        "properties": {
                            "region_id": region_id,
                            "name": f"Region {region_id}",
                            "description": region_descriptions[region_id],
                            "v_b0_value": {v: k for k, v in region_mapping.items()}[region_id]
                        },
                        "geometry": {
                            "type": "MultiPolygon",
                            "coordinates": []
                        }
                    }
                    
                    # Collect all polygon coordinates
                    all_polygons = []
                    for geom in regions[region_id]:
                        if geom.get('type') == 'MultiPolygon':
                            all_polygons.extend(geom.get('coordinates', []))
                        elif geom.get('type') == 'Polygon':
                            all_polygons.append(geom.get('coordinates', []))
                    
                    combined_feature["geometry"]["coordinates"] = all_polygons
                    combined_feature["properties"]["feature_count"] = len(all_polygons)
                    combined_features.append(combined_feature)
            
            regions_geojson = {
                "type": "FeatureCollection",
                "features": combined_features
            }
            
            return Response(regions_geojson)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def coastline(self, request):
        """Get the physical coastline boundaries as GeoJSON"""
        try:
            import json
            from django.conf import settings
            import os
            
            geojson_path = os.path.join(settings.BASE_DIR, 'backend', 'data', 'france_coastline.geojson')
            
            if not os.path.exists(geojson_path):
                return Response(
                    {'error': 'Coastline GeoJSON file not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
            with open(geojson_path, 'r') as f:
                data = json.load(f)
                
            return Response(data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def coastline_buffer(self, request):
        """Get the 1km physical coastline buffer zone as GeoJSON"""
        try:
            import json
            from django.conf import settings
            import os
            
            geojson_path = os.path.join(settings.BASE_DIR, 'backend', 'data', 'france_coastline_buffer_1km.geojson')
            
            if not os.path.exists(geojson_path):
                return Response(
                    {'error': 'Coastline buffer GeoJSON file not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
            with open(geojson_path, 'r') as f:
                data = json.load(f)
                
            return Response(data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    @action(detail=False, methods=['get'], url_name='transition-zones', url_path='transition_zones')
    def transition_zones(self, request):
        """Get transition zones within a bounding box"""
        try:
            import json
            bbox_str = request.query_params.get('bbox')
            if not bbox_str:
                return Response(
                    {'error': 'bbox parameter is required (min_lon,min_lat,max_lon,max_lat)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            coords = [float(x) for x in bbox_str.split(',')]
            if len(coords) != 4:
                return Response(
                    {'error': 'bbox parameter must contain exactly 4 coordinates'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            min_lon, min_lat, max_lon, max_lat = coords
            
            from shapely.geometry import box
            bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
            
            from .services import TerrainClassificationService
            terrain_service = TerrainClassificationService.get_instance()
            
            # Load land use data
            gdf = terrain_service._load_land_use_data()
            
            # Find intersecting polygons within bbox
            # Spatial index pre-filtering to keep it fast
            possible_matches_index = gdf.sindex.query(bbox_geom, predicate="intersects")
            intersects = gdf.iloc[possible_matches_index]
            
            transition_geojson = {"type": "FeatureCollection", "features": []}
            if len(intersects) > 0:
                # Project to EPSG:2154 for metric operations
                intersects_projected = intersects.to_crs(epsg=2154)
                
                # Get CLC mappings
                from .terrain_config_service import terrain_config_service
                clc_mappings = terrain_config_service.get_clc_code_mappings()
                terrain_II_codes = clc_mappings.get('terrain_II', {}).get('codes', [])
                terrain_IIIa_codes = clc_mappings.get('terrain_IIIa', {}).get('codes', [])
                target_codes = list(terrain_II_codes) + list(terrain_IIIa_codes)
                
                terrain_IV_codes = clc_mappings.get('terrain_IV', {}).get('codes', [])
                terrain_IIIb_codes = clc_mappings.get('terrain_IIIb', {}).get('codes', [])
                urban_codes = list(terrain_IV_codes) + list(terrain_IIIb_codes)
                
                urban_polygons = intersects_projected[intersects_projected['Code_18'].isin(urban_codes)]
                target_polygons = intersects_projected[intersects_projected['Code_18'].isin(target_codes)]
                
                if len(urban_polygons) > 0 and len(target_polygons) > 0:
                    # Buffer target polygons by 50m
                    buffered_targets = target_polygons.geometry.buffer(50.0).unary_union
                    # Intersect with urban polygons to find transition zones
                    transition_zones = urban_polygons.geometry.intersection(buffered_targets)
                    
                    import geopandas as gpd
                    transition_gdf = gpd.GeoDataFrame(geometry=transition_zones, crs="EPSG:2154").to_crs(epsg=4326)
                    transition_gdf = transition_gdf[~transition_gdf.geometry.is_empty]
                    
                    if len(transition_gdf) > 0:
                        transition_gdf['type'] = 'transition_zone'
                        transition_geojson = json.loads(transition_gdf[['geometry', 'type']].to_json())
            
            return Response(transition_geojson)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def region(self, request):
        """Get specific region boundary as GeoJSON from actual wind coefficient data"""
        region_id = request.query_params.get('region_id')
        
        if not region_id:
            return Response(
                {'error': 'region_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            import json
            from collections import defaultdict
            from django.conf import settings
            import os
            
            region_id = int(region_id)
            if region_id not in [1, 2, 3, 4]:
                return Response(
                    {'error': 'Invalid region_id. Must be 1, 2, 3, or 4'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Load the actual GeoJSON file
            geojson_path = os.path.join(settings.BASE_DIR, 'backend', 'data', 'ec1_windCoeff.geojson')
            
            with open(geojson_path, 'r') as f:
                data = json.load(f)
            
            # Group features by V_B0 value (region)
            region_mapping = {
                22: 1,  # Region 1
                24: 2,  # Region 2
                26: 3,  # Region 3
                28: 4   # Region 4
            }
            
            region_descriptions = {
                1: "Northern France (V_B0: 22)",
                2: "Western France (V_B0: 24)", 
                3: "Central France (V_B0: 26)",
                4: "Eastern France (V_B0: 28)"
            }
            
            # Find the V_B0 value for this region
            v_b0_value = {v: k for k, v in region_mapping.items()}[region_id]
            
            # Collect all geometries for this specific region
            all_polygons = []
            for feature in data.get('features', []):
                v_b0 = feature.get('properties', {}).get('V_B0')
                if v_b0 == v_b0_value:
                    geom = feature.get('geometry')
                    if geom.get('type') == 'MultiPolygon':
                        all_polygons.extend(geom.get('coordinates', []))
                    elif geom.get('type') == 'Polygon':
                        all_polygons.append(geom.get('coordinates', []))
            
            # Create the region feature
            region_feature = {
                "type": "Feature",
                "properties": {
                    "region_id": region_id,
                    "name": f"Region {region_id}",
                    "description": region_descriptions[region_id],
                    "v_b0_value": v_b0_value,
                    "feature_count": len(all_polygons)
                },
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": all_polygons
                }
            }
            
            return Response(region_feature)
            
        except ValueError:
            return Response(
                {'error': 'Invalid region_id format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@csrf_exempt
@require_http_methods(["POST"])
def terrain_classification_api(request):
    """API endpoint for terrain classification at coordinates"""
    try:
        data = json.loads(request.body)
        latitude = float(data.get('latitude'))
        longitude = float(data.get('longitude'))
        
        if not latitude or not longitude:
            return JsonResponse(
                {'error': 'Latitude and longitude are required'},
                status=400
            )
        
        # Initialize terrain classification service using singleton
        terrain_service = TerrainClassificationService.get_instance()
        
        # Get terrain type at coordinates
        terrain_type = terrain_service.get_terrain_type_at_coordinates(longitude, latitude)
        
        if terrain_type is None:
            return JsonResponse({
                'terrain_type': None,
                'error': 'No terrain data found at these coordinates',
                'latitude': latitude,
                'longitude': longitude
            })
        
        # Get spatial extent percentages
        gdf = terrain_service._load_land_use_data()
        spatial_extent = terrain_service._calculate_spatial_extent_percentages(
            longitude, latitude, gdf
        )
        
        return JsonResponse({
            'terrain_type': terrain_type,
            'spatial_extent': spatial_extent,
            'latitude': latitude,
            'longitude': longitude
        })
        
    except ValueError as e:
        return JsonResponse(
            {'error': f'Invalid coordinates: {str(e)}'},
            status=400
        )
    except Exception as e:
        return JsonResponse(
            {'error': f'Server error: {str(e)}'},
            status=500
        )


@csrf_exempt
@require_http_methods(["POST"])
def terrain_classification_fast_api(request):
    """Fast API endpoint for basic terrain classification without detailed analysis"""
    try:
        data = json.loads(request.body)
        latitude = float(data.get('latitude'))
        longitude = float(data.get('longitude'))
        
        if not latitude or not longitude:
            return JsonResponse(
                {'error': 'Latitude and longitude are required'},
                status=400
            )
        
        # Initialize terrain classification service using singleton
        terrain_service = TerrainClassificationService.get_instance()
        
        # Get just the terrain type without spatial analysis for fastest response
        terrain_type = terrain_service.get_terrain_type_at_coordinates(longitude, latitude)
        
        return JsonResponse({
            'terrain_type': terrain_type,
            'latitude': latitude,
            'longitude': longitude,
            'fast_response': True
        })
        
    except ValueError as e:
        return JsonResponse(
            {'error': f'Invalid coordinates: {str(e)}'},
            status=400
        )
    except Exception as e:
        return JsonResponse(
            {'error': f'Server error: {str(e)}'},
            status=500
        )


@csrf_exempt
@cache_page(60 * 60)  # Cache tiles for 1 hour
def bdtopo_tile_proxy(request, z, x, y):
    """
    Proxy endpoint for BDTOPO vector tiles from IGN France.
    This avoids CORS issues and allows proper tile serving to the frontend.
    Uses IGN's public TMS service which doesn't require authentication.
    """
    try:
        # Construct the IGN TMS URL (public service, no auth required)
        ign_url = f'https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf'
        
        # Fetch the tile from IGN
        response = requests.get(ign_url, timeout=10)
        
        # Check if the request was successful
        if response.status_code == 200:
            # Get the content type from the response
            content_type = response.headers.get('Content-Type', 'application/x-protobuf')
            
            # Return the tile data with appropriate headers
            return HttpResponse(
                response.content,
                content_type=content_type,
                status=response.status_code
            )
        else:
            # Return error response
            return HttpResponse(
                b'',
                status=response.status_code
            )
            
    except requests.exceptions.RequestException as e:
        return HttpResponse(
            f'Error fetching tile: {str(e)}',
            status=502
        )
    except Exception as e:
        return HttpResponse(
            f'Server error: {str(e)}',
            status=500
        )


def send_ws_notification(email, notification_data):
    """Send a WebSocket notification to a specific email's channel group"""
    import hashlib
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    channel_layer = get_channel_layer()
    email_hash = hashlib.md5(email.encode()).hexdigest()
    group_name = f'notifications_{email_hash}'

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'send_notification',
            'notification': notification_data
        }
    )


class HeightCalculationRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for managing height calculation requests"""
    queryset = HeightCalculationRequest.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'region', 'montage_type']
    search_fields = ['requester_name', 'requester_email', 'address', 'montage_type']
    ordering_fields = ['created_at', 'updated_at', 'status']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['create', 'my_requests']:
            self.permission_classes = [permissions.AllowAny]
        else:
            self.permission_classes = [IsAdminOrEngineerPermission]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return HeightCalculationRequestSerializer
        return HeightCalculationRequestAdminSerializer

    def perform_create(self, serializer):
        """Create a height calculation request and notify génie civil via WebSocket"""
        instance = serializer.save()

        # Create a notification for the génie civil team (all staff users)
        from django.contrib.auth.models import User as AuthUser
        staff_users = AuthUser.objects.filter(is_staff=True)
        for staff in staff_users:
            Notification.objects.create(
                recipient_email=staff.email,
                recipient_user=staff,
                title='Nouvelle demande de calcul',
                message=f"{instance.requester_name} a demandé un calcul pour une hauteur de {instance.requested_building_height}m (Montage {instance.montage_type})",
                notification_type='request_received',
                related_request=instance,
            )
            # Send WebSocket notification to staff
            try:
                send_ws_notification(staff.email, {
                    'id': instance.id,
                    'type': 'request_received',
                    'title': 'Nouvelle demande de calcul',
                    'message': f"{instance.requester_name} a demandé un calcul pour une hauteur de {instance.requested_building_height}m",
                    'request_id': instance.id,
                })
            except Exception:
                pass  # Don't fail if WebSocket isn't available

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update the status of a request and notify the requester"""
        height_request = self.get_object()
        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes', '')

        if new_status not in dict(HeightCalculationRequest.STATUS_CHOICES):
            return Response(
                {'error': f'Statut invalide : {new_status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = height_request.status
        height_request.status = new_status
        if admin_notes:
            height_request.admin_notes = admin_notes
        if request.user.is_authenticated:
            height_request.assigned_to = request.user
        height_request.save()

        # Determine notification type and message
        status_messages = {
            'in_progress': ('request_in_progress', 'Demande en cours de traitement',
                            f'Votre demande de calcul pour {height_request.requested_building_height}m est maintenant en cours de traitement.'),
            'completed': ('request_completed', 'Demande terminée',
                          f'Les calculs pour la hauteur {height_request.requested_building_height}m sont maintenant disponibles !'),
            'rejected': ('request_rejected', 'Demande rejetée',
                         f'Votre demande de calcul pour {height_request.requested_building_height}m a été rejetée. {admin_notes}'),
        }

        if new_status in status_messages and new_status != old_status:
            notif_type, title, message = status_messages[new_status]

            # Create notification in database
            notif = Notification.objects.create(
                recipient_email=height_request.requester_email,
                recipient_user=height_request.requester_user,
                title=title,
                message=message,
                notification_type=notif_type,
                related_request=height_request,
            )

            # Send real-time WebSocket notification
            try:
                send_ws_notification(height_request.requester_email, {
                    'id': notif.id,
                    'type': notif_type,
                    'title': title,
                    'message': message,
                    'request_id': height_request.id,
                    'new_status': new_status,
                })
            except Exception:
                pass

        serializer = HeightCalculationRequestAdminSerializer(height_request)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def my_requests(self, request):
        """Get requests by email (public access for tracking)"""
        email = request.query_params.get('email')
        if not email:
            return Response(
                {'error': 'Le paramètre email est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        requests_qs = HeightCalculationRequest.objects.filter(requester_email=email)
        serializer = HeightCalculationRequestSerializer(requests_qs, many=True)
        return Response(serializer.data)


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing notifications"""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.AllowAny]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        email = self.request.query_params.get('email')
        if email:
            return Notification.objects.filter(recipient_email=email)
        if self.request.user.is_authenticated:
            return Notification.objects.filter(recipient_user=self.request.user)
        return Notification.objects.none()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'Notification marquée comme lue'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for an email"""
        email = request.data.get('email')
        if not email:
            return Response(
                {'error': 'Le paramètre email est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        count = Notification.objects.filter(recipient_email=email, is_read=False).update(is_read=True)
        return Response({'status': f'{count} notifications marquées comme lues'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get unread notification count"""
        email = request.query_params.get('email')
        if not email:
            return Response(
                {'error': 'Le paramètre email est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        count = Notification.objects.filter(recipient_email=email, is_read=False).count()
        return Response({'count': count})

