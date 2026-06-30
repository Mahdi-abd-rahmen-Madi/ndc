from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Role, EngineerProfile, CalculationJob


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class EngineerProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = EngineerProfile
        fields = ['id', 'user', 'username', 'email', 'employee_id', 'specializations', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    role = RoleSerializer(read_only=True)
    engineer_profile = EngineerProfileSerializer(read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'username', 'email', 'first_name', 'last_name',
            'phone', 'department', 'role', 'engineer_profile', 'avatar',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

class CalculationJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculationJob
        fields = ['id', 'user', 'input_hash', 'input_data', 'status', 'result_data', 'error_message', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'input_hash', 'status', 'result_data', 'error_message', 'created_at', 'updated_at']


class SiteSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=['nouveau', 'existant'])
    ancrage = serializers.ChoiceField(choices=['metallique', 'beton', 'encastre'], required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

class EnvironmentSerializer(serializers.Serializer):
    region = serializers.IntegerField()
    terrain_type = serializers.CharField()
    building_height_m = serializers.FloatField()
    dalle_thickness_m = serializers.FloatField(required=False, allow_null=True)
    plot_height_m = serializers.FloatField(required=False, allow_null=True)

class StructureSerializer(serializers.Serializer):
    mast_height_m = serializers.FloatField()
    montage_id = serializers.CharField()
    is_custom_montage = serializers.BooleanField(default=False)
    mat_principal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    plot_metallique = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bras_de_deport = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    mat_secondaire = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class AntennaSerializer(serializers.Serializer):
    model = serializers.CharField()
    height_mm = serializers.FloatField()
    width_mm = serializers.FloatField()
    thickness_mm = serializers.FloatField()
    weight_dan = serializers.FloatField()

class FHEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    weight_kg = serializers.FloatField(required=False, allow_null=True)

class LRHEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class LRUEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class CatalogueMatchSerializer(serializers.Serializer):
    found = serializers.BooleanField()
    equipment_id = serializers.IntegerField(required=False, allow_null=True)
    material_specification = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class CalculationPayloadSerializer(serializers.Serializer):
    schema_version = serializers.CharField(default="1.0")
    site = SiteSerializer()
    environment = EnvironmentSerializer()
    structure = StructureSerializer()
    antenna_4g = AntennaSerializer()
    antenna_5g = AntennaSerializer()
    fh_equipment = FHEquipmentSerializer(required=False)
    lrh_equipment = LRHEquipmentSerializer(required=False)
    lru_equipment = LRUEquipmentSerializer(required=False)
    catalogue_match = CatalogueMatchSerializer(required=False)
