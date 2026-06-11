from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    AntennaEquipment, AntennaSpecification, TerrainLoadCalculation,
    TerrainDocumentation, AntennaEquipmentHistory,
    HeightCalculationRequest, Notification
)


class ResponsibleUserSerializer(serializers.ModelSerializer):
    """Lightweight serializer for responsible user information"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class AntennaSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AntennaSpecification
        fields = [
            'id', 'antenna_type', 'height_mm', 'width_mm',
            'thickness_mm', 'weight_dan'
        ]


class TerrainDocumentationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerrainDocumentation
        fields = ['id', 'terrain_type', 'document_urls', 'local_document_urls', 'document_types', 'upload_date']


class TerrainLoadCalculationSerializer(serializers.ModelSerializer):
    documentation = TerrainDocumentationSerializer(read_only=True)
    document_urls = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = TerrainLoadCalculation
        fields = [
            'id', 'terrain_type', 'section_material',
            'material_specification', 'load_calculations', 'documentation', 'document_urls'
        ]


class AntennaEquipmentSerializer(serializers.ModelSerializer):
    specifications = AntennaSpecificationSerializer(many=True)
    terrain_calculations = TerrainLoadCalculationSerializer(many=True)
    responsible_user = ResponsibleUserSerializer(read_only=True)

    class Meta:
        model = AntennaEquipment
        fields = [
            'id', 'name', 'sub_elements', 'responsible_person', 'responsible_user',
            'status', 'date', 'region', 'building_height', 'mast_height', 'comments',
            'item_id', 'is_deleted', 'specifications', 'terrain_calculations',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_building_height(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Building height must be positive.")
        return value

    def validate_mast_height(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Mast height must be positive.")
        return value

    def extract_file_types(self, document_urls):
        file_types = []
        if document_urls:
            urls = [url.strip() for url in document_urls.split(',') if url.strip()]
            for url in urls:
                if '.' in url:
                    ext = '.' + url.split('.')[-1].lower()
                    if ext not in file_types:
                        file_types.append(ext)
        return file_types

    def create(self, validated_data):
        specs_data = validated_data.pop('specifications', [])
        calcs_data = validated_data.pop('terrain_calculations', [])

        equipment = AntennaEquipment.objects.create(**validated_data)

        # Create specifications
        for spec_data in specs_data:
            AntennaSpecification.objects.create(equipment=equipment, **spec_data)

        # Create terrain calculations and documentations
        for calc_data in calcs_data:
            document_urls = calc_data.pop('document_urls', '')
            terrain_type = calc_data.get('terrain_type')
            
            doc = None
            if document_urls:
                doc = TerrainDocumentation.objects.create(
                    equipment=equipment,
                    terrain_type=terrain_type,
                    document_urls=document_urls,
                    document_types=self.extract_file_types(document_urls)
                )

            TerrainLoadCalculation.objects.create(
                equipment=equipment,
                documentation=doc,
                **calc_data
            )

        return equipment

    def update(self, instance, validated_data):
        specs_data = validated_data.pop('specifications', None)
        calcs_data = validated_data.pop('terrain_calculations', None)

        # Update core fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update specifications if provided
        if specs_data is not None:
            instance.specifications.all().delete()
            for spec_data in specs_data:
                AntennaSpecification.objects.create(equipment=instance, **spec_data)

        # Update terrain calculations if provided
        if calcs_data is not None:
            for calc_data in calcs_data:
                terrain_type = calc_data.get('terrain_type')
                section_material = calc_data.get('section_material', '')
                material_specification = calc_data.get('material_specification', '')
                load_calculations = calc_data.get('load_calculations', {})
                document_urls = calc_data.pop('document_urls', '')

                # Find or create TerrainLoadCalculation
                load_calc, created = TerrainLoadCalculation.objects.get_or_create(
                    equipment=instance,
                    terrain_type=terrain_type
                )
                load_calc.section_material = section_material
                load_calc.material_specification = material_specification
                load_calc.load_calculations = load_calculations

                # Find or create/update documentation
                doc = load_calc.documentation
                if document_urls:
                    if doc:
                        doc.document_urls = document_urls
                        doc.document_types = self.extract_file_types(document_urls)
                        doc.save()
                    else:
                        doc = TerrainDocumentation.objects.create(
                            equipment=instance,
                            terrain_type=terrain_type,
                            document_urls=document_urls,
                            document_types=self.extract_file_types(document_urls)
                        )
                        load_calc.documentation = doc
                else:
                    if doc:
                        load_calc.documentation = None
                        doc.delete()

                load_calc.save()

        return instance


class AntennaEquipmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    specifications_count = serializers.SerializerMethodField()
    terrain_calculations_count = serializers.SerializerMethodField()
    responsible_user = ResponsibleUserSerializer(read_only=True)
    responsible_display = serializers.SerializerMethodField()

    class Meta:
        model = AntennaEquipment
        fields = [
            'id', 'name', 'responsible_person', 'responsible_user', 'responsible_display',
            'region', 'building_height', 'mast_height', 'is_deleted', 'specifications_count', 
            'terrain_calculations_count', 'created_at'
        ]

    def get_specifications_count(self, obj):
        return obj.specifications.count()

    def get_terrain_calculations_count(self, obj):
        return obj.terrain_calculations.count()
    
    def get_responsible_display(self, obj):
        """Display both responsible_user and responsible_person for compatibility"""
        if obj.responsible_user:
            return f"{obj.responsible_user.username}"
        return obj.responsible_person or 'Not assigned'


class AntennaEquipmentHistorySerializer(serializers.ModelSerializer):
    """Serializer for version history entries"""
    user_display = serializers.SerializerMethodField()

    class Meta:
        model = AntennaEquipmentHistory
        fields = ['id', 'equipment', 'user', 'user_display', 'action', 'changed_at', 'snapshot']
        read_only_fields = ['id', 'equipment', 'user', 'action', 'changed_at', 'snapshot']

    def get_user_display(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'Système'


class HeightCalculationRequestSerializer(serializers.ModelSerializer):
    """Serializer for creating height calculation requests (public)"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = HeightCalculationRequest
        fields = [
            'id', 'requester_name', 'requester_email', 'requester_phone',
            'requested_building_height', 'mast_height', 'montage_type',
            'terrain_type', 'region', 'latitude', 'longitude', 'address',
            'description', 'status', 'status_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'status_display', 'created_at', 'updated_at']


class HeightCalculationRequestAdminSerializer(serializers.ModelSerializer):
    """Serializer for admin/engineer management of requests"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_display = serializers.SerializerMethodField()
    requester_display = serializers.SerializerMethodField()

    class Meta:
        model = HeightCalculationRequest
        fields = [
            'id', 'requester_name', 'requester_email', 'requester_phone', 'requester_user',
            'requested_building_height', 'mast_height', 'montage_type',
            'terrain_type', 'region', 'latitude', 'longitude', 'address',
            'description', 'status', 'status_display', 'assigned_to', 'assigned_to_display',
            'admin_notes', 'completed_equipment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'requester_name', 'requester_email', 'requester_phone',
                            'requester_user', 'requested_building_height', 'mast_height',
                            'montage_type', 'terrain_type', 'region', 'latitude', 'longitude',
                            'address', 'description', 'created_at', 'updated_at']

    def get_assigned_to_display(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_requester_display(self, obj):
        return f"{obj.requester_name} ({obj.requester_email})"


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for user notifications"""
    type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'link', 'is_read',
            'notification_type', 'type_display', 'related_request',
            'created_at'
        ]
        read_only_fields = ['id', 'title', 'message', 'link', 'notification_type',
                            'type_display', 'related_request', 'created_at']

