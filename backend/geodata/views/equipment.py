"""Equipment, specification, and terrain load calculation ViewSets (N+1 optimized)."""
import logging
import os

from django.conf import settings
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from api.permissions import IsAdminOrEngineerPermission, IsAdminOrResponsibleEngineerPermission
from geodata.catalogue_loader import load_catalogue_dict
from geodata.models import (
    AntennaEquipment,
    AntennaEquipmentHistory,
    AntennaSpecification,
    CatalogueConfig,
    TerrainLoadCalculation,
)
from geodata.serializers import (
    AntennaEquipmentHistorySerializer,
    AntennaEquipmentListSerializer,
    AntennaEquipmentSerializer,
    AntennaSpecificationSerializer,
    TerrainLoadCalculationSerializer,
)
from geodata.services import TerrainClassificationService, terrain_service
from utils.path_security import safe_resolve_under

logger = logging.getLogger(__name__)


class AntennaEquipmentViewSet(viewsets.ModelViewSet):
    """ViewSet for AntennaEquipment model."""

    permission_classes = [IsAdminOrEngineerPermission]
    queryset = AntennaEquipment.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['region', 'status']
    search_fields = ['name', 'responsible_person', 'sub_elements', 'item_id']
    ordering_fields = ['name', 'created_at', 'building_height', 'mast_height']
    ordering = ['name']

    def get_queryset(self):
        """
        Filter queryset based on user role and responsibility, with eager loading
        and annotated counts to eliminate N+1 queries.
        """
        user = self.request.user
        include_deleted = self.request.query_params.get('include_deleted', 'false').lower() == 'true'
        only_deleted = self.request.query_params.get('only_deleted', 'false').lower() == 'true'

        if self.action == 'list' and not user.is_authenticated:
            qs = AntennaEquipment.objects.all()
        elif user.is_staff or user.is_superuser:
            qs = AntennaEquipment.objects.all()
        else:
            qs = AntennaEquipment.objects.filter(responsible_user=user)

        if only_deleted:
            qs = qs.filter(is_deleted=True)
        elif not include_deleted:
            qs = qs.filter(is_deleted=False)

        qs = qs.select_related('responsible_user')
        if self.action == 'list':
            qs = qs.annotate(
                specifications_count_annotated=Count('specifications', distinct=True),
                terrain_calculations_count_annotated=Count('terrain_calculations', distinct=True),
            )
        else:
            qs = qs.prefetch_related('specifications', 'terrain_calculations__documentation')

        return qs

    def get_permissions(self):
        if self.action in ['list', 'public_lookup', 'catalogue_config']:
            self.permission_classes = [permissions.AllowAny]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdminOrResponsibleEngineerPermission]
        else:
            self.permission_classes = [IsAdminOrEngineerPermission]
        return super().get_permissions()

    def perform_create(self, serializer):
        if hasattr(self.request.user, 'engineer_profile'):
            instance = serializer.save(responsible_user=self.request.user)
        else:
            instance = serializer.save()

        AntennaEquipmentHistory.objects.create(
            equipment=instance,
            user=self.request.user,
            action='CREATE',
            snapshot=instance.create_snapshot(),
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        AntennaEquipmentHistory.objects.create(
            equipment=instance,
            user=self.request.user,
            action='UPDATE',
            snapshot=instance.create_snapshot(),
        )
        serializer.save()

    def perform_destroy(self, instance):
        AntennaEquipmentHistory.objects.create(
            equipment=instance,
            user=self.request.user,
            action='DELETE',
            snapshot=instance.create_snapshot(),
        )
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted', 'updated_at'])

    def get_serializer_class(self):
        if self.action == 'list':
            return AntennaEquipmentListSerializer
        return AntennaEquipmentSerializer

    @action(detail=True, methods=['get'])
    def specifications(self, request, pk=None):
        equipment = self.get_object()
        serializer = AntennaSpecificationSerializer(equipment.specifications.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def terrain_calculations(self, request, pk=None):
        equipment = self.get_object()
        calculations = equipment.terrain_calculations.select_related('documentation').all()
        serializer = TerrainLoadCalculationSerializer(calculations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def terrain_type(self, request, pk=None):
        equipment = self.get_object()
        if not hasattr(equipment, 'longitude') or not hasattr(equipment, 'latitude'):
            return Response(
                {'error': 'Equipment must have longitude and latitude coordinates'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            terrain_type = terrain_service.get_terrain_type_for_equipment(equipment)
            if terrain_type:
                return Response({
                    'terrain_type': terrain_type,
                    'coordinates': {
                        'longitude': float(equipment.longitude),
                        'latitude': float(equipment.latitude),
                    },
                })
            return Response(
                {'error': 'No terrain classification found at these coordinates'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        equipment = self.get_object()
        history = equipment.history.select_related('user').all().order_by('-changed_at')
        serializer = AntennaEquipmentHistorySerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='restore/(?P<history_id>[0-9]+)')
    def restore_version(self, request, pk=None, history_id=None):
        equipment = self.get_object()
        try:
            history_entry = AntennaEquipmentHistory.objects.get(id=history_id, equipment=equipment)
        except AntennaEquipmentHistory.DoesNotExist:
            return Response({'error': 'Version introuvable'}, status=status.HTTP_404_NOT_FOUND)

        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='RESTORE',
            snapshot=equipment.create_snapshot(),
        )
        equipment.restore_snapshot(history_entry.snapshot)
        serializer = AntennaEquipmentSerializer(equipment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def soft_delete(self, request, pk=None):
        equipment = self.get_object()
        if equipment.is_deleted:
            return Response({'error': 'Cet équipement est déjà supprimé'}, status=status.HTTP_400_BAD_REQUEST)
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='DELETE',
            snapshot=equipment.create_snapshot(),
        )
        equipment.is_deleted = True
        equipment.save(update_fields=['is_deleted', 'updated_at'])
        return Response({'status': 'Déplacé vers la corbeille'})

    @action(detail=True, methods=['post'])
    def undelete(self, request, pk=None):
        equipment = self.get_object()
        if not equipment.is_deleted:
            return Response({'error': "Cet équipement n'est pas supprimé"}, status=status.HTTP_400_BAD_REQUEST)
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='RESTORE',
            snapshot=equipment.create_snapshot(),
        )
        equipment.is_deleted = False
        equipment.save(update_fields=['is_deleted', 'updated_at'])
        return Response({'status': 'Restauré depuis la corbeille'})

    @action(detail=True, methods=['delete'])
    def permanent_delete(self, request, pk=None):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(
                {'error': 'Seuls les administrateurs peuvent supprimer définitivement'},
                status=status.HTTP_403_FORBIDDEN,
            )
        equipment = self.get_object()
        equipment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_file(self, request, pk=None):
        equipment = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        montage_name = os.path.basename(equipment.name.lower().replace(' ', '_'))
        catalogue_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue', montage_name)
        os.makedirs(catalogue_dir, exist_ok=True)

        safe_filename = os.path.basename(file_obj.name or '').strip()
        if not safe_filename or safe_filename in ('.', '..'):
            return Response({'error': 'Nom de fichier invalide'}, status=status.HTTP_400_BAD_REQUEST)

        file_path = safe_resolve_under(catalogue_dir, safe_filename)
        if not file_path:
            return Response({'error': 'Chemin de fichier invalide'}, status=status.HTTP_400_BAD_REQUEST)

        with open(file_path, 'wb+') as dest:
            for chunk in file_obj.chunks():
                dest.write(chunk)

        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='UPDATE',
            snapshot=equipment.create_snapshot(),
        )

        return Response({
            'status': 'Fichier téléversé',
            'filename': safe_filename,
            'path': f'/media/catalogue/{montage_name}/{safe_filename}',
        })

    @action(detail=True, methods=['get'])
    def list_files(self, request, pk=None):
        equipment = self.get_object()
        montage_name = equipment.name.lower().replace(' ', '_')
        safe_item_id = (equipment.item_id or str(equipment.id)).replace(' ', '_').lower()

        manual_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue', montage_name)
        terrain_dir = os.path.join(settings.MEDIA_ROOT, 'catalogue', 'terrain', safe_item_id)

        files = []
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
                            'rel_path': os.path.relpath(entry_path, manual_dir),
                        })

        if os.path.isdir(terrain_dir):
            for root, _, filenames in os.walk(terrain_dir):
                for entry in filenames:
                    entry_path = os.path.join(root, entry)
                    if os.path.isfile(entry_path):
                        rel_path = os.path.relpath(entry_path, settings.MEDIA_ROOT)
                        rel_parts = os.path.relpath(root, terrain_dir).split(os.sep)
                        files.append({
                            'name': entry,
                            'size': os.path.getsize(entry_path),
                            'url': f'/media/{rel_path}',
                            'source': 'Monday / Terrain',
                            'category': 'terrain',
                            'terrain_type': rel_parts[0] if len(rel_parts) > 0 else 'Inconnu',
                            'region': rel_parts[1] if len(rel_parts) > 1 else 'Inconnu',
                            'height': rel_parts[2] if len(rel_parts) > 2 else 'Inconnu',
                            'rel_path': os.path.join('terrain', os.path.relpath(entry_path, terrain_dir)),
                        })

        return Response(files)

    @action(detail=True, methods=['delete'], url_path='delete_file/(?P<filename>.+)')
    def delete_file(self, request, pk=None, filename=None):
        equipment = self.get_object()
        montage_name = equipment.name.lower().replace(' ', '_')
        safe_item_id = (equipment.item_id or str(equipment.id)).replace(' ', '_').lower()

        manual_dir = os.path.abspath(os.path.join(settings.MEDIA_ROOT, 'catalogue', montage_name))
        terrain_dir = os.path.abspath(os.path.join(settings.MEDIA_ROOT, 'catalogue', 'terrain', safe_item_id))

        if filename.startswith('terrain/'):
            target_path = safe_resolve_under(terrain_dir, filename[len('terrain/'):])
        else:
            target_path = safe_resolve_under(manual_dir, filename)

        if not target_path or not os.path.isfile(target_path):
            return Response({'error': 'Fichier introuvable ou accès refusé'}, status=status.HTTP_404_NOT_FOUND)

        os.remove(target_path)
        AntennaEquipmentHistory.objects.create(
            equipment=equipment,
            user=request.user,
            action='UPDATE',
            snapshot=equipment.create_snapshot(),
        )
        return Response({'status': 'Fichier supprimé'})

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def catalogue_config(self, request):
        config = CatalogueConfig.get_solo()
        cat_dict = load_catalogue_dict()
        return Response({
            'precalculated_building_heights': config.precalculated_building_heights or cat_dict.get('precalculated_building_heights', []),
            'recommended_mast_heights': config.recommended_mast_heights or cat_dict.get('recommended_mast_heights', []),
            'fh_weight_options': config.fh_weight_options or cat_dict.get('fh_weight_options', []),
            'standard_montages': config.standard_montages or cat_dict.get('standard_montages', []),
            'coffret_references': cat_dict.get('coffret_references') or getattr(config, 'coffret_references', []),
            'fh_references': getattr(config, 'fh_references', None) or cat_dict.get('fh_references', []),
            'td_references': cat_dict.get('td_references') or getattr(config, 'td_references', []),
            'tgbt_references': cat_dict.get('tgbt_references') or getattr(config, 'tgbt_references', []),
            'rru_references': config.rru_references or cat_dict.get('rru_references', []),
            'rrh_references': config.rrh_references or cat_dict.get('rrh_references', []),
            'atelier_energie_references': cat_dict.get('atelier_energie_references') or getattr(config, 'atelier_energie_references', []),
            'baie_references': getattr(config, 'baie_references', None) or cat_dict.get('baie_references', []),
            'real_world_references': config.real_world_references or cat_dict.get('real_world_references', []),
        })

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def public_lookup(self, request):
        latitude = request.query_params.get('latitude')
        longitude = request.query_params.get('longitude')
        mast_height = request.query_params.get('mast_height')
        building_height = request.query_params.get('building_height')

        if latitude is None or longitude is None or latitude == '' or longitude == '':
            return Response(
                {'error': 'Both latitude and longitude parameters are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat = float(latitude)
            lon = float(longitude)
        except ValueError:
            return Response({'error': 'Invalid coordinate format'}, status=status.HTTP_400_BAD_REQUEST)

        ts = TerrainClassificationService.get_instance()
        terrain_type = None
        try:
            terrain_type = ts.get_terrain_type_at_coordinates(lon, lat)
        except Exception as e:
            logger.error("Error classifying terrain for public lookup: %s", e)

        region_number = None
        try:
            region_number = ts.get_region_from_coordinates(lon, lat)
        except Exception as e:
            logger.error("Error getting region for public lookup: %s", e)

        queryset = (
            AntennaEquipment.objects.filter(is_deleted=False)
            .select_related('responsible_user')
            .prefetch_related('specifications', 'terrain_calculations__documentation')
        )

        if region_number:
            queryset = queryset.filter(region=region_number)

        if mast_height:
            try:
                mh = float(mast_height)
                if mh in [3.0, 4.0]:
                    queryset = queryset.filter(Q(mast_height=mh) | Q(mast_height__isnull=True))
                else:
                    queryset = queryset.filter(mast_height=mh)
            except ValueError:
                pass

        if building_height:
            try:
                queryset = queryset.filter(building_height=float(building_height))
            except ValueError:
                pass

        montage = request.query_params.get('montage')
        if montage:
            queryset = queryset.filter(
                Q(name__iexact=f"Montage {montage}") | Q(name__istartswith=f"Montage {montage}.")
            )

        serializer = AntennaEquipmentSerializer(queryset, many=True)
        return Response({
            'detected_terrain_type': terrain_type,
            'detected_region': region_number,
            'equipment': serializer.data,
        })


class AntennaSpecificationViewSet(viewsets.ModelViewSet):
    """ViewSet for AntennaSpecification model."""

    permission_classes = [IsAdminOrEngineerPermission]
    serializer_class = AntennaSpecificationSerializer
    queryset = AntennaSpecification.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['antenna_type', 'equipment']
    search_fields = ['equipment__name', 'antenna_type']
    ordering_fields = ['equipment__name', 'antenna_type', 'height_mm', 'width_mm']
    ordering = ['equipment__name', 'antenna_type']

    def get_queryset(self):
        user = self.request.user
        base = AntennaSpecification.objects.select_related('equipment')
        if user.is_staff or user.is_superuser:
            return base
        return base.filter(equipment__responsible_user=user)

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdminOrResponsibleEngineerPermission]
        else:
            self.permission_classes = [IsAdminOrEngineerPermission]
        return super().get_permissions()

    def perform_create(self, serializer):
        equipment = serializer.validated_data['equipment']
        antenna_type = serializer.validated_data['antenna_type']

        if hasattr(self.request.user, 'engineer_profile') and equipment.responsible_user != self.request.user:
            raise serializers.ValidationError(
                "You can only create specifications for equipment you are responsible for."
            )

        if AntennaSpecification.objects.filter(equipment=equipment, antenna_type=antenna_type).exists():
            raise serializers.ValidationError({
                'antenna_type': 'This equipment already has a specification for this antenna type.'
            })

        serializer.save()


class TerrainLoadCalculationViewSet(viewsets.ModelViewSet):
    """ViewSet for TerrainLoadCalculation model."""

    permission_classes = [IsAdminOrEngineerPermission]
    serializer_class = TerrainLoadCalculationSerializer
    queryset = TerrainLoadCalculation.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['terrain_type', 'equipment']
    search_fields = ['equipment__name', 'terrain_type', 'section_material']
    ordering_fields = ['equipment__name', 'terrain_type', 'created_at']
    ordering = ['equipment__name', 'terrain_type']

    def get_queryset(self):
        user = self.request.user
        base = TerrainLoadCalculation.objects.select_related('equipment', 'documentation')
        if user.is_staff or user.is_superuser:
            return base
        return base.filter(equipment__responsible_user=user)

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdminOrResponsibleEngineerPermission]
        else:
            self.permission_classes = [IsAdminOrEngineerPermission]
        return super().get_permissions()

    def perform_create(self, serializer):
        equipment = serializer.validated_data['equipment']
        terrain_type = serializer.validated_data['terrain_type']

        if hasattr(self.request.user, 'engineer_profile') and equipment.responsible_user != self.request.user:
            raise serializers.ValidationError(
                "You can only create terrain calculations for equipment you are responsible for."
            )

        if TerrainLoadCalculation.objects.filter(equipment=equipment, terrain_type=terrain_type).exists():
            raise serializers.ValidationError({
                'terrain_type': 'This equipment already has a calculation for this terrain type.'
            })

        serializer.save()

