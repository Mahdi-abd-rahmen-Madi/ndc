from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _


class AntennaEquipment(models.Model):
    """Represents antenna equipment and mounting systems"""
    
    REGION_CHOICES = [
        (1, "Region 1"),
        (2, "Region 2"), 
        (3, "Region 3"),
        (4, "Region 4"),
    ]
    
    # Mapping from V_B0 values to region numbers
    V_B0_TO_REGION = {
        22: 1,  # Region 1
        24: 2,  # Region 2
        26: 3,  # Region 3
        28: 4,  # Region 4
    }
    
    # Terrain classification mapping from CLC Code_18 to terrain types
    CLC_CODE_TO_TERRAIN = {
        # Terrain 0: Water/coastal areas (Mer, océan, lacs, côte exposée au vent)
        '511': '0',   # Water courses
        '512': '0',   # Water bodies  
        '521': '0',   # Coastal lagoons
        '522': '0',   # Estuaries
        '523': '0',   # Sea and ocean
        '423': '0',   # Intertidal flats
        '421': '0',   # Salt marshes
        '422': '0',   # Salines
        # Additional water codes for complete coverage
        '331': '0',   # Beaches, dunes, sands (côte directement exposée au vent)
        '332': '0',   # Bare rocks
        '333': '0',   # Sparsely vegetated areas
        '334': '0',   # Burnt areas
        '335': '0',   # Glaciers and perpetual snow
        
        # Terrain II: Open countryside (rase campagne) - Champs agricoles, prairie, quelques arbres ou bâtiments isolés
        '211': 'II',   # Non-irrigated arable land
        '212': 'II',   # Permanently irrigated land
        '213': 'II',   # Rice fields
        '231': 'II',   # Pastures
        
        # Terrain IIIa: Campaign with obstacles (bocage, habitat dispersé) - Bocage, vignobles, haies, habitat dispersé
        '221': 'IIIa', # Vineyards
        '222': 'IIIa', # Fruit trees and berry plantations
        '223': 'IIIa', # Olive groves
        '241': 'IIIa', # Annual crops associated with permanent crops
        '242': 'IIIa', # Complex cultivation patterns (typical bocage)
        '243': 'IIIa', # Land principally occupied by agriculture with significant areas of natural vegetation
        '244': 'IIIa', # Agro-forestry areas (classic bocage)
        '311': 'IIIa', # Broad-leaved forest
        '312': 'IIIa', # Coniferous forest
        '313': 'IIIa', # Mixed forest
        '321': 'IIIa', # Natural grasslands
        '322': 'IIIa', # Moors and heathland
        '323': 'IIIa', # Sclerophyllous vegetation
        '324': 'IIIa', # Transitional woodland-shrub
        '411': 'IIIa', # Inland marshes
        '412': 'IIIa', # Peat bogs
        
        # Terrain IIIb: Zone semi-urbaine / plus dense - Zones industrielles, zones agricoles denses, vergers, maisons rapprochées
        '121': 'IIIb', # Industrial or commercial units
        '122': 'IIIb', # Road and rail networks and associated land
        '123': 'IIIb', # Port areas
        '124': 'IIIb', # Airports
        '131': 'IIIb', # Mineral extraction sites
        '132': 'IIIb', # Dump sites
        '133': 'IIIb', # Construction sites
        '142': 'IIIb', # Sport and leisure facilities
        
        # Terrain IV: Zone urbaine dense - Ville, immeubles, bâtiments hauts (>15m), densité importante
        '111': 'IV',   # Continuous urban fabric
        '112': 'IV',   # Discontinuous urban fabric
        '141': 'IV',   # Green urban areas
    }
    
    name = models.CharField(max_length=255, verbose_name=_("Equipment Name"))
    sub_elements = models.CharField(max_length=255, blank=True, verbose_name=_("Sub Elements"))
    responsible_person = models.CharField(max_length=255, blank=True, verbose_name=_("Responsible Person"))
    responsible_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipment_responsible', verbose_name=_("Responsible User"))
    status = models.CharField(max_length=50, blank=True, verbose_name=_("Status"))
    date = models.DateField(null=True, blank=True, verbose_name=_("Date"))
    region = models.IntegerField(choices=REGION_CHOICES, blank=True, null=True, verbose_name=_("Region"))
    building_height = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name=_("Building Height (m)"))
    mast_height = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name=_("Mast Height (m)"))
    comments = models.TextField(blank=True, verbose_name=_("Comments"))
    item_id = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name=_("Item ID"))
    is_deleted = models.BooleanField(default=False, verbose_name=_("Is Deleted"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Antenna Equipment")
        verbose_name_plural = _("Antenna Equipment")
        ordering = ['name']

    def create_snapshot(self):
        """Creates a complete JSON-serializable snapshot of this equipment configuration"""
        specs = []
        for s in self.specifications.all():
            specs.append({
                'antenna_type': s.antenna_type,
                'height_mm': float(s.height_mm),
                'width_mm': float(s.width_mm),
                'thickness_mm': float(s.thickness_mm),
                'weight_dan': float(s.weight_dan),
            })
        
        calcs = []
        for c in self.terrain_calculations.all():
            doc_urls = c.documentation.document_urls if c.documentation else ""
            local_urls = c.documentation.local_document_urls if c.documentation else ""
            doc_types = c.documentation.document_types if c.documentation else []
            calcs.append({
                'terrain_type': c.terrain_type,
                'section_material': c.section_material,
                'material_specification': c.material_specification,
                'load_calculations': c.load_calculations,
                'documentation': {
                    'document_urls': doc_urls,
                    'local_document_urls': local_urls,
                    'document_types': doc_types,
                }
            })

        return {
            'name': self.name,
            'sub_elements': self.sub_elements,
            'responsible_person': self.responsible_person,
            'status': self.status,
            'date': str(self.date) if self.date else None,
            'region': self.region,
            'building_height': float(self.building_height) if self.building_height else None,
            'mast_height': float(self.mast_height) if self.mast_height else None,
            'comments': self.comments,
            'item_id': self.item_id,
            'specifications': specs,
            'calculations': calcs,
        }

    def restore_snapshot(self, snapshot):
        """Restores this equipment, its specifications, and calculations to a previous snapshot state"""
        from django.db import transaction
        
        with transaction.atomic():
            self.name = snapshot['name']
            self.sub_elements = snapshot['sub_elements']
            self.responsible_person = snapshot['responsible_person']
            self.status = snapshot['status']
            self.date = snapshot['date']
            self.region = snapshot['region']
            self.building_height = snapshot['building_height']
            self.mast_height = snapshot['mast_height']
            self.comments = snapshot['comments']
            self.item_id = snapshot['item_id']
            self.is_deleted = False
            self.save()

            # Restore specifications
            self.specifications.all().delete()
            for s in snapshot.get('specifications', []):
                AntennaSpecification.objects.create(
                    equipment=self,
                    antenna_type=s['antenna_type'],
                    height_mm=s['height_mm'],
                    width_mm=s['width_mm'],
                    thickness_mm=s['thickness_mm'],
                    weight_dan=s['weight_dan'],
                )

            # Restore calculations and documentations
            for c in self.terrain_calculations.all():
                if c.documentation:
                    c.documentation.delete()
                c.delete()

            for c in snapshot.get('calculations', []):
                doc_data = c.get('documentation', {})
                doc = None
                if doc_data:
                    doc = TerrainDocumentation.objects.create(
                        equipment=self,
                        terrain_type=c['terrain_type'],
                        document_urls=doc_data.get('document_urls', ''),
                        local_document_urls=doc_data.get('local_document_urls', ''),
                        document_types=doc_data.get('document_types', []),
                    )
                
                TerrainLoadCalculation.objects.create(
                    equipment=self,
                    terrain_type=c['terrain_type'],
                    section_material=c['section_material'],
                    material_specification=c['material_specification'],
                    load_calculations=c['load_calculations'],
                    documentation=doc,
                )

    @classmethod
    def get_region_from_vb0(cls, vb0_value):
        """Get region number from V_B0 value"""
        return cls.V_B0_TO_REGION.get(vb0_value)
    
    @classmethod
    def get_terrain_from_clc_code(cls, clc_code):
        """Get terrain type from CLC Code_18 value"""
        return cls.CLC_CODE_TO_TERRAIN.get(str(clc_code))
    
    @classmethod
    def get_all_terrain_mappings(cls):
        """Get all terrain mappings for reference"""
        return cls.CLC_CODE_TO_TERRAIN.copy()
    
    def save(self, *args, **kwargs):
        if self.responsible_person:
            cleaned = self.responsible_person.strip()
            if cleaned.lower() in ['dhouha abbassi', 'da', 'dhouha', 'abbassi']:
                self.responsible_person = 'DA'
            else:
                self.responsible_person = cleaned
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class AntennaSpecification(models.Model):
    """Represents technical specifications for 4G/5G antennas"""
    ANTENNA_TYPES = [
        ('4G', '4G'),
        ('5G', '5G'),
    ]

    equipment = models.ForeignKey(AntennaEquipment, on_delete=models.CASCADE, related_name='specifications', verbose_name=_("Equipment"))
    antenna_type = models.CharField(max_length=10, choices=ANTENNA_TYPES, verbose_name=_("Antenna Type"))
    height_mm = models.DecimalField(max_digits=8, decimal_places=2, verbose_name=_("Height (mm)"))
    width_mm = models.DecimalField(max_digits=8, decimal_places=2, verbose_name=_("Width (mm)"))
    thickness_mm = models.DecimalField(max_digits=8, decimal_places=2, verbose_name=_("Thickness (mm)"))
    weight_dan = models.DecimalField(max_digits=8, decimal_places=2, verbose_name=_("Weight (daN)"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Antenna Specification")
        verbose_name_plural = _("Antenna Specifications")
        ordering = ['equipment', 'antenna_type']
        unique_together = ['equipment', 'antenna_type']

    def __str__(self):
        return f"{self.equipment.name} - {self.antenna_type}"


class TerrainDocumentation(models.Model):
    """Represents documentation files for terrain calculations"""
    TERRAIN_TYPES = [
        ('0', 'Terrain 0'),
        ('II', 'Terrain II'),
        ('IIIa', 'Terrain IIIa'),
        ('IIIb', 'Terrain IIIb'),
        ('IV', 'Terrain IV'),
    ]

    equipment = models.ForeignKey(AntennaEquipment, on_delete=models.CASCADE, related_name='terrain_documentations', verbose_name=_("Equipment"))
    terrain_type = models.CharField(max_length=10, choices=TERRAIN_TYPES, verbose_name=_("Terrain Type"))
    document_urls = models.TextField(help_text=_("Comma-separated URLs for terrain calculation documents"), verbose_name=_("Document URLs"))
    document_types = models.JSONField(default=list, blank=True, help_text=_("List of document file extensions (e.g., ['.docx', '.rtd'])"), verbose_name=_("Document Types"))
    local_document_urls = models.TextField(blank=True, default='', help_text=_("Comma-separated local paths/URLs for the downloaded documents"), verbose_name=_("Local Document URLs"))
    upload_date = models.DateTimeField(auto_now_add=True, verbose_name=_("Upload Date"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Terrain Documentation")
        verbose_name_plural = _("Terrain Documentations")
        ordering = ['equipment', 'terrain_type']
        unique_together = ['equipment', 'terrain_type']

    def __str__(self):
        return f"{self.equipment.name} - {self.terrain_type} Documentation"

    def get_document_list(self):
        """Parse document URLs into a list"""
        if self.document_urls:
            return [url.strip() for url in self.document_urls.split(',') if url.strip()]
        return []


class TerrainLoadCalculation(models.Model):
    """Represents terrain load calculations for equipment"""
    TERRAIN_TYPES = [
        ('0', 'Terrain 0'),
        ('II', 'Terrain II'),
        ('IIIa', 'Terrain IIIa'),
        ('IIIb', 'Terrain IIIb'),
        ('IV', 'Terrain IV'),
    ]

    equipment = models.ForeignKey(AntennaEquipment, on_delete=models.CASCADE, related_name='terrain_calculations', verbose_name=_("Equipment"))
    terrain_type = models.CharField(max_length=10, choices=TERRAIN_TYPES, verbose_name=_("Terrain Type"))
    section_material = models.CharField(max_length=255, blank=True, verbose_name=_("Section Material"))
    material_specification = models.CharField(max_length=255, blank=True, help_text=_("Material section specification (e.g., '139x6.3mm')"), verbose_name=_("Material Specification"))
    load_calculations = models.JSONField(default=dict, blank=True, verbose_name=_("Load Calculations"))
    documentation = models.OneToOneField(TerrainDocumentation, on_delete=models.SET_NULL, null=True, blank=True, related_name='load_calculation', verbose_name=_("Documentation"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Terrain Load Calculation")
        verbose_name_plural = _("Terrain Load Calculations")
        ordering = ['equipment', 'terrain_type']
        unique_together = ['equipment', 'terrain_type']

    def __str__(self):
        return f"{self.equipment.name} - {self.terrain_type}"


class Building(gis_models.Model):
    """Represents building footprints imported from Etalab French cadastre"""
    id = gis_models.CharField(max_length=50, primary_key=True)
    commune_insee = gis_models.CharField(max_length=5, db_index=True)
    building_type = gis_models.CharField(max_length=2)
    geometry = gis_models.MultiPolygonField(srid=4326)
    centroid = gis_models.PointField(srid=4326, null=True, blank=True)
    department_code = gis_models.CharField(max_length=3, db_index=True)
    data_source = gis_models.CharField(max_length=20, default='etalab_cadastre')
    last_import = gis_models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Building")
        verbose_name_plural = _("Buildings")
        indexes = [
            gis_models.Index(fields=['department_code', 'commune_insee']),
        ]

    def __str__(self):
        return f"Building {self.id} ({self.commune_insee})"


class BuildingBlock(gis_models.Model):
    """Represents merged/aggregated building footprints (agglomerations)"""
    id = gis_models.AutoField(primary_key=True)
    department_code = gis_models.CharField(max_length=3, db_index=True)
    commune_insee = gis_models.CharField(max_length=5, db_index=True)
    geometry = gis_models.MultiPolygonField(srid=4326)
    building_count = gis_models.IntegerField(default=1)
    last_update = gis_models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Building Block")
        verbose_name_plural = _("Building Blocks")
        indexes = [
            gis_models.Index(fields=['department_code', 'commune_insee']),
        ]

    def __str__(self):
        return f"BuildingBlock {self.id} ({self.commune_insee}) - {self.building_count} bldgs"


class CadastreUpdateStatus(gis_models.Model):
    """Tracks update status for cadastre departments"""
    department_code = gis_models.CharField(max_length=3)
    data_type = gis_models.CharField(max_length=20)  # e.g., 'buildings'
    last_update = gis_models.DateTimeField()
    record_count = gis_models.IntegerField(default=0)
    status = models.CharField(max_length=20)  # e.g., 'SUCCESS', 'FAILED'
    data_version = models.CharField(max_length=20)  # e.g., date of data

    class Meta:
        verbose_name = _("Cadastre Update Status")
        verbose_name_plural = _("Cadastre Update Statuses")
        unique_together = ('department_code', 'data_type')

    def __str__(self):
        return f"{self.department_code} - {self.data_type}: {self.status}"


class AntennaEquipmentHistory(models.Model):
    """Represents version control history snapshots for antenna equipment"""
    equipment = models.ForeignKey(AntennaEquipment, on_delete=models.CASCADE, related_name='history', verbose_name=_("Equipment"))
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipment_history', verbose_name=_("User"))
    action = models.CharField(max_length=50, verbose_name=_("Action"))  # 'CREATE', 'UPDATE', 'DELETE', 'RESTORE'
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Changed At"))
    snapshot = models.JSONField(verbose_name=_("Snapshot"))

    class Meta:
        verbose_name = _("Antenna Equipment History")
        verbose_name_plural = _("Antenna Equipment Histories")
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.equipment.name} - {self.action} at {self.changed_at}"


class HeightCalculationRequest(models.Model):
    """Demande de calcul pour une hauteur de bâtiment non-existante dans le catalogue"""
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('in_progress', 'En cours'),
        ('completed', 'Terminée'),
        ('rejected', 'Rejetée'),
    ]

    # Requester information
    requester_name = models.CharField(max_length=255, verbose_name=_("Nom du demandeur"))
    requester_email = models.EmailField(verbose_name=_("Email du demandeur"))
    requester_phone = models.CharField(max_length=30, blank=True, default='', verbose_name=_("Téléphone"))
    requester_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='height_requests', verbose_name=_("Utilisateur demandeur")
    )

    # Technical details (pre-filled from the lookup context)
    requested_building_height = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name=_("Hauteur bâtiment demandée (m)")
    )
    mast_height = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name=_("Hauteur du mât (m)")
    )
    montage_type = models.CharField(max_length=50, verbose_name=_("Type de montage"))
    terrain_type = models.CharField(max_length=10, blank=True, default='', verbose_name=_("Type de terrain"))
    region = models.IntegerField(null=True, blank=True, verbose_name=_("Région"))
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True, verbose_name=_("Latitude")
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True, verbose_name=_("Longitude")
    )
    address = models.TextField(blank=True, default='', verbose_name=_("Adresse"))
    description = models.TextField(blank=True, default='', verbose_name=_("Description / justification"))

    # Status tracking
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name=_("Statut")
    )
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_height_requests', verbose_name=_("Assigné à")
    )
    admin_notes = models.TextField(blank=True, default='', verbose_name=_("Notes internes"))
    completed_equipment = models.ForeignKey(
        AntennaEquipment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='fulfilled_requests', verbose_name=_("Équipement créé")
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Créé le"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Mis à jour le"))

    class Meta:
        verbose_name = _("Demande de calcul de hauteur")
        verbose_name_plural = _("Demandes de calcul de hauteur")
        ordering = ['-created_at']

    def __str__(self):
        return f"Demande #{self.pk} — {self.requested_building_height}m ({self.get_status_display()})"


class Notification(models.Model):
    """Notification en temps réel pour les utilisateurs"""
    NOTIFICATION_TYPES = [
        ('request_received', 'Demande reçue'),
        ('request_in_progress', 'Demande en cours'),
        ('request_completed', 'Demande terminée'),
        ('request_rejected', 'Demande rejetée'),
        ('info', 'Information'),
    ]

    recipient_email = models.EmailField(verbose_name=_("Email du destinataire"))
    recipient_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='notifications', verbose_name=_("Utilisateur destinataire")
    )
    title = models.CharField(max_length=255, verbose_name=_("Titre"))
    message = models.TextField(verbose_name=_("Message"))
    link = models.CharField(max_length=500, blank=True, default='', verbose_name=_("Lien"))
    is_read = models.BooleanField(default=False, verbose_name=_("Lu"))
    notification_type = models.CharField(
        max_length=30, choices=NOTIFICATION_TYPES, default='info', verbose_name=_("Type")
    )
    related_request = models.ForeignKey(
        HeightCalculationRequest, on_delete=models.CASCADE, null=True, blank=True,
        related_name='notifications', verbose_name=_("Demande associée")
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Créé le"))

    class Meta:
        verbose_name = _("Notification")
        verbose_name_plural = _("Notifications")
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.title} → {self.recipient_email}"
