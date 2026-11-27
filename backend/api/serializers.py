from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Role, EngineerProfile, CalculationJob, GeneratedSiteNdc
from utils.domain_constants import (
    ALLOWED_FH_DIAMETERS,
    DEFAULT_STRUCTURE_CASE,
    FH_DEFAULT_MAST_SECTION,
    STRUCTURE_CASES,
    normalize_structure_case,
)


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
    engineer_profile = EngineerProfileSerializer(source='user.engineer_profile', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'username', 'email', 'first_name', 'last_name',
            'phone', 'department', 'role', 'engineer_profile', 'avatar',
            'client_logo', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

class CalculationJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculationJob
        fields = [
            'id', 'user', 'client_id', 'calculation_type', 'ndc_hash', 'input_hash', 'is_cached',
            'input_data', 'status', 'result_data', 'error_message',
            'screenshot', 'verification_screenshot',
            'note_de_calcul', 'note_mat', 'note_plot', 'assemblage_note', 'reactions_file',
            'note_de_calcul_rrh', 'rrh_assemblage_note', 'rrh_verification_screenshot',
            'rrh_tableau_charges', 'rrh_reactions_file', 'rrh_screenshot',
            'note_de_calcul_fh', 'fh_note_mat', 'fh_note_plot', 'fh_assemblage_note',
            'fh_verification_screenshot', 'fh_tableau_charges', 'fh_reactions_file', 'fh_screenshot',
            'compiled_docx', 'compiled_pdf', 'credits_consumed',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'ndc_hash', 'input_hash', 'is_cached', 'status', 'result_data',
            'error_message', 'screenshot', 'verification_screenshot',
            'note_de_calcul', 'note_mat', 'note_plot', 'assemblage_note', 'reactions_file',
            'note_de_calcul_rrh', 'rrh_assemblage_note', 'rrh_verification_screenshot',
            'rrh_tableau_charges', 'rrh_reactions_file', 'rrh_screenshot',
            'note_de_calcul_fh', 'fh_note_mat', 'fh_note_plot', 'fh_assemblage_note',
            'fh_verification_screenshot', 'fh_tableau_charges', 'fh_reactions_file', 'fh_screenshot',
            'compiled_docx', 'compiled_pdf', 'credits_consumed',
            'created_at', 'updated_at'
        ]


class GeneratedSiteNdcSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneratedSiteNdc
        fields = [
            'id', 'user', 'site_name', 'code_site', 'client_name',
            'address', 'operator', 'pdf_url', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']



class SiteSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=['nouveau', 'existant'], required=False, allow_null=True)
    ancrage = serializers.ChoiceField(choices=['metallique', 'beton', 'encastre', 'dallettes'], required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    code_site = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ref_site = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    client = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    client_logo_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    operator = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)

class EnvironmentSerializer(serializers.Serializer):
    region = serializers.IntegerField()
    terrain_type = serializers.CharField()
    building_height_m = serializers.FloatField(required=False, allow_null=True)
    dalle_thickness_m = serializers.FloatField(required=False, allow_null=True)
    etancheite = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    plot_height_m = serializers.FloatField(required=False, allow_null=True)

class StructureSerializer(serializers.Serializer):
    structure_case = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=DEFAULT_STRUCTURE_CASE
    )
    hauteur_mat_m = serializers.FloatField(required=False, allow_null=True)
    hauteur_plot_m = serializers.FloatField(required=False, allow_null=True)
    plot_h_m = serializers.FloatField(required=False, allow_null=True)
    sans_plot = serializers.BooleanField(required=False, default=False)
    montage_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')
    is_custom_montage = serializers.BooleanField(default=False, required=False)
    mat_principal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    plot_metallique = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bras_de_deport_input = serializers.FloatField(required=False, allow_null=True)
    mat_secondaire = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    material_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    plot_section = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bras_section = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    mast_5g_section = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    mast_section = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nombre_secteurs = serializers.IntegerField(required=False, allow_null=True, default=3)

    def validate_structure_case(self, value):
        normalized = normalize_structure_case(value)
        if normalized not in STRUCTURE_CASES:
            raise serializers.ValidationError(
                f"structure_case must be one of {', '.join(STRUCTURE_CASES)} (got {value!r})."
            )
        return normalized

class AntennaSerializer(serializers.Serializer):
    model = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    quantite = serializers.IntegerField(required=False, allow_null=True, default=1)
    hauteur_mm = serializers.FloatField(required=False, allow_null=True)
    largeur_mm = serializers.FloatField(required=False, allow_null=True)
    epaisseur_mm = serializers.FloatField(required=False, allow_null=True)
    poids_kg = serializers.FloatField(required=False, allow_null=True)
    hauteur_mat_antenne_m = serializers.FloatField(required=False, allow_null=True)

class StructureFHSerializer(serializers.Serializer):
    mast_section = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=FH_DEFAULT_MAST_SECTION)
    plot_section = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="TCAR 150x5")
    hauteur_mat_m = serializers.FloatField(required=False, allow_null=True, default=1.70)
    hauteur_plot_m = serializers.FloatField(required=False, allow_null=True, default=0.50)
    sans_plot = serializers.BooleanField(required=False, default=False)

class EquipmentItemSerializer(serializers.Serializer):
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    quantity = serializers.IntegerField(required=False, allow_null=True)
    diameter_mm = serializers.FloatField(required=False, allow_null=True)
    weight_kg = serializers.FloatField(required=False, allow_null=True)

class FHEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=False)
    hauteur_mat_m = serializers.FloatField(required=False, allow_null=True)
    sans_plot = serializers.BooleanField(required=False, default=False)
    with_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    diameter_mm = serializers.FloatField(required=False, allow_null=True)
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="Antenne FH")
    quantity = serializers.IntegerField(required=False, allow_null=True, default=1)
    weight_kg = serializers.FloatField(required=False, allow_null=True)
    ancrage = serializers.ChoiceField(choices=['metallique', 'beton', 'dallettes'], required=False, allow_null=True)
    echelle = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    def validate(self, data):
        if data.get('enabled'):
            items = data.get('items') or []
            if not items:
                diam = data.get('diameter_mm')
                weight = data.get('weight_kg')
                if diam is None or int(float(diam)) not in ALLOWED_FH_DIAMETERS or float(diam) % 1 != 0:
                    raise serializers.ValidationError(
                        f"FH diameter_mm must be one of 300, 600, 900, 1200 mm (got {diam})."
                    )
                if weight is None or float(weight) <= 0:
                    raise serializers.ValidationError("FH weight_kg must be > 0.")
            else:
                for idx, it in enumerate(items, 1):
                    diam = it.get('diameter_mm') or data.get('diameter_mm')
                    weight = it.get('weight_kg') or data.get('weight_kg')
                    if diam is None or int(float(diam)) not in ALLOWED_FH_DIAMETERS or float(diam) % 1 != 0:
                        raise serializers.ValidationError(
                            f"FH item #{idx}: diameter_mm must be one of 300, 600, 900, 1200 mm (got {diam})."
                        )
                    if weight is None or float(weight) <= 0:
                        raise serializers.ValidationError(f"FH item #{idx}: weight_kg must be > 0.")
        return data

class EquipmentPayloadSerializer(serializers.Serializer):
    model = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    quantite = serializers.IntegerField(required=False, allow_null=True, default=1)
    qty = serializers.IntegerField(required=False, allow_null=True)
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    poids_kg = serializers.FloatField(required=False, allow_null=True)
    hauteur_mm = serializers.FloatField(required=False, allow_null=True)
    largeur_mm = serializers.FloatField(required=False, allow_null=True)
    epaisseur_mm = serializers.FloatField(required=False, allow_null=True)

class RRHEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=False)
    hauteur_mat_m = serializers.FloatField(required=False, allow_null=True)
    sans_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    with_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    ancrage = serializers.ChoiceField(choices=['metallique', 'beton', 'dallettes'], required=False, allow_null=True)
    echelle = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="Pas d'échelle")
    items = EquipmentItemSerializer(many=True, required=False)

class RRUEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=False)
    hauteur_mat_m = serializers.FloatField(required=False, allow_null=True)
    sans_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    with_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    ancrage = serializers.ChoiceField(choices=['metallique', 'beton', 'dallettes'], required=False, allow_null=True)
    echelle = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="Pas d'échelle")
    items = EquipmentItemSerializer(many=True, required=False)

class StructureLovageSerializer(serializers.Serializer):
    mast_section = serializers.CharField(required=False, default="TRON 88x3.2", allow_blank=True, allow_null=True)
    plot_section = serializers.CharField(required=False, default="TCAR 150x5", allow_blank=True, allow_null=True)
    hauteur_mat_m = serializers.FloatField(required=False, default=1.50, allow_null=True)
    hauteur_plot_m = serializers.FloatField(required=False, default=0.50, allow_null=True)
    sans_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    with_plot = serializers.BooleanField(required=False, allow_null=True, default=None)

class GpsEquipmentSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=False)
    quantity = serializers.IntegerField(required=False, default=1, allow_null=True, min_value=1)
    marque = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    dimensions = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    weight_kg = serializers.FloatField(required=False, allow_null=True)
    poids_kg = serializers.FloatField(required=False, allow_null=True)


class ConvertisseurMdeaSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=False)
    quantity = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    quantite = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    dimensions = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    hauteur_mm = serializers.FloatField(required=False, allow_null=True)
    largeur_mm = serializers.FloatField(required=False, allow_null=True)
    epaisseur_mm = serializers.FloatField(required=False, allow_null=True)
    h_mm = serializers.FloatField(required=False, allow_null=True)
    w_mm = serializers.FloatField(required=False, allow_null=True)
    d_mm = serializers.FloatField(required=False, allow_null=True)
    poids = serializers.FloatField(required=False, allow_null=True)
    poids_kg = serializers.FloatField(required=False, allow_null=True)
    weight_kg = serializers.FloatField(required=False, allow_null=True)
    cf_front = serializers.FloatField(required=False, allow_null=True, default=1.46)
    cf_lat = serializers.FloatField(required=False, allow_null=True, default=1.12)


class BoitierLovageSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=False)
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    quantity = serializers.IntegerField(required=False, default=1, allow_null=True, min_value=1)
    hauteur_mat_m = serializers.FloatField(required=False, allow_null=True, default=1.50)
    ancrage = serializers.ChoiceField(choices=['metallique', 'beton', 'dallettes'], required=False, allow_null=True)
    echelle = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="Pas d'échelle")
    sans_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    with_plot = serializers.BooleanField(required=False, allow_null=True, default=None)
    cf_front = serializers.FloatField(required=False, allow_null=True, default=1.47)
    cf_lat = serializers.FloatField(required=False, allow_null=True, default=1.19)
    hauteur_mm = serializers.FloatField(required=False, allow_null=True)
    largeur_mm = serializers.FloatField(required=False, allow_null=True)
    epaisseur_mm = serializers.FloatField(required=False, allow_null=True)
    poids_kg = serializers.FloatField(required=False, allow_null=True)
    dimensions = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = EquipmentItemSerializer(many=True, required=False)
    has_gps = serializers.BooleanField(required=False, allow_null=True, default=None)
    has_mdea = serializers.BooleanField(required=False, allow_null=True, default=None)
    gps = GpsEquipmentSerializer(required=False, allow_null=True)
    mdea = ConvertisseurMdeaSerializer(required=False, allow_null=True)

class CatalogueMatchSerializer(serializers.Serializer):
    found = serializers.BooleanField(required=False, default=False)
    equipment_id = serializers.IntegerField(required=False, allow_null=True)
    material_specification = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class CalculationPayloadSerializer(serializers.Serializer):
    schema_version = serializers.CharField(default="1.0", required=False)
    client_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_rrh = serializers.BooleanField(required=False, default=False)
    is_rru = serializers.BooleanField(required=False, default=False)
    is_fh = serializers.BooleanField(required=False, default=False)
    is_lovage = serializers.BooleanField(required=False, default=False)
    sans_plot = serializers.BooleanField(required=False, default=None, allow_null=True)
    operateur = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    calculation_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    force_recalculate = serializers.BooleanField(required=False, default=False)

    site = SiteSerializer(required=False, allow_null=True)
    environment = EnvironmentSerializer()
    structure = StructureSerializer()
    structure_fh = StructureFHSerializer(required=False, allow_null=True)
    structure_lovage = StructureLovageSerializer(required=False, allow_null=True)
    antenna_4g = AntennaSerializer(required=False, allow_null=True)
    antenna_5g = AntennaSerializer(required=False, allow_null=True)
    equipment = EquipmentPayloadSerializer(required=False, allow_null=True)
    fh_equipment = FHEquipmentSerializer(required=False, allow_null=True)
    rrh_equipment = RRHEquipmentSerializer(required=False, allow_null=True)
    rru_equipment = RRUEquipmentSerializer(required=False, allow_null=True)
    boitier_lovage = BoitierLovageSerializer(required=False, allow_null=True)
    lovage_equipment = BoitierLovageSerializer(required=False, allow_null=True)
    gps = GpsEquipmentSerializer(required=False, allow_null=True)
    convertisseur_mdea = ConvertisseurMdeaSerializer(required=False, allow_null=True)
    catalogue_match = CatalogueMatchSerializer(required=False, allow_null=True)

    def validate(self, data):
        rrh_enabled = bool((data.get("rrh_equipment") or {}).get("enabled")) or bool(data.get("is_rrh"))
        rru_enabled = bool((data.get("rru_equipment") or {}).get("enabled")) or bool(data.get("is_rru"))
        if rrh_enabled and rru_enabled:
            raise serializers.ValidationError(
                "Les équipements RRH et RRU sont mutuellement exclusifs et ne peuvent "
                "pas être activés simultanément sur un même site."
            )
        return data
