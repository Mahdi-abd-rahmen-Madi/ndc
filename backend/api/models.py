from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _


class Role(models.Model):
    """Role model for RBAC system"""
    name = models.CharField(max_length=50, unique=True, verbose_name=_("Role Name"))
    description = models.TextField(blank=True, verbose_name=_("Description"))
    permissions = models.JSONField(default=dict, blank=True, verbose_name=_("Permissions"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Role")
        verbose_name_plural = _("Roles")
        ordering = ['name']

    def __str__(self):
        return self.name


class EngineerProfile(models.Model):
    """Engineer-specific profile for RBAC"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='engineer_profile', verbose_name=_("User"))
    employee_id = models.CharField(max_length=50, unique=True, verbose_name=_("Employee ID"))
    specializations = models.JSONField(default=list, blank=True, verbose_name=_("Specializations"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Engineer Profile")
        verbose_name_plural = _("Engineer Profiles")

    def __str__(self):
        return f"{self.user.username} - {self.employee_id}"


class UserProfile(models.Model):
    """Extended user profile"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile', verbose_name=_("User"))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_("Phone Number"))
    department = models.CharField(max_length=255, blank=True, verbose_name=_("Department"))
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("Role"))
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name=_("Avatar"))
    client_logo = models.ImageField(upload_to='client_logos/', blank=True, null=True, verbose_name=_("Client Logo"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("User Profile")
        verbose_name_plural = _("User Profiles")

    def __str__(self):
        return f"{self.user.username}'s Profile"


class ClientSubscription(models.Model):
    """Client subscription for tracking calculation quotas"""
    TIER_CHOICES = [
        ('BASIC', 'Basic'),
        ('PRO', 'Pro'),
        ('ENTERPRISE', 'Enterprise'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription', verbose_name=_("User"))
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='BASIC', verbose_name=_("Tier"))
    monthly_quota = models.IntegerField(default=50, verbose_name=_("Monthly Quota"))
    used_quota = models.IntegerField(default=0, verbose_name=_("Used Quota"))
    billing_cycle_reset = models.DateField(null=True, blank=True, verbose_name=_("Billing Cycle Reset"))

    class Meta:
        verbose_name = _("Client Subscription")
        verbose_name_plural = _("Client Subscriptions")

    def __str__(self):
        return f"{self.user.username} - {self.tier} ({self.used_quota}/{self.monthly_quota})"



class CalculationJob(models.Model):
    """
    Stores calculation jobs sent to the Unified Robot Worker.
    Acts as a catalog to cache results if the same input is requested again.
    """
    CALC_TYPES = [
        ("antenna", "Antenne (Base)"),
        ("rrh", "RRH"),
        ("parabole", "Parabole"),
        ("coffret", "Coffret"),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('REJECTED', 'Rejected'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='calculation_jobs', verbose_name=_("User"))
    client_id = models.CharField(max_length=128, default="default_client", blank=True, verbose_name=_("Client ID"))
    calculation_type = models.CharField(max_length=32, choices=CALC_TYPES, default="antenna", verbose_name=_("Calculation Type"))

    # Deterministic physical hash for instant deduplication & caching
    ndc_hash = models.CharField(max_length=64, db_index=True, null=True, blank=True, verbose_name=_("NDC Hash"))
    input_hash = models.CharField(max_length=64, db_index=True, blank=True, null=True, verbose_name=_("Legacy Input Hash"))
    is_cached = models.BooleanField(default=False, verbose_name=_("Is Cached"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name=_("Status"))
    input_data = models.JSONField(default=dict, verbose_name=_("Input Data"))
    result_data = models.JSONField(null=True, blank=True, verbose_name=_("Result Data"))
    error_message = models.TextField(blank=True, null=True, verbose_name=_("Error Message"))
    credits_consumed = models.IntegerField(default=1, verbose_name=_("Credits Consumed"))

    # Base Antenna Files
    screenshot = models.ImageField(upload_to='screenshots/', null=True, blank=True, verbose_name=_("Screenshot"))
    verification_screenshot = models.ImageField(upload_to='screenshots/verification/', null=True, blank=True, verbose_name=_("Verification Screenshot"))
    note_de_calcul = models.FileField(upload_to='notes_de_calcul/', null=True, blank=True, verbose_name=_("Note de Calcul"))
    note_mat = models.FileField(upload_to='notes_de_calcul/', null=True, blank=True, verbose_name=_("Note Mât (RTF)"))
    note_plot = models.FileField(upload_to='notes_de_calcul/', null=True, blank=True, verbose_name=_("Note Plot (RTF)"))
    assemblage_note = models.FileField(upload_to='assemblages/', null=True, blank=True, verbose_name=_("Assemblage Note"))
    reactions_file = models.FileField(upload_to='reactions/', null=True, blank=True, verbose_name=_("Reactions File"))

    # Dedicated RRH Support Files (Preserves Antenna files in composite Antenna+RRH jobs)
    note_de_calcul_rrh = models.FileField(upload_to='notes_rrh/', null=True, blank=True, verbose_name=_("Note de Calcul RRH (RTF)"))
    rrh_assemblage_note = models.FileField(upload_to='notes_rrh/', null=True, blank=True, verbose_name=_("Note Assemblage RRH (RTF)"))
    rrh_verification_screenshot = models.ImageField(upload_to='verif_rrh/', null=True, blank=True, verbose_name=_("Capture Vérification RRH"))
    rrh_tableau_charges = models.ImageField(upload_to='charges_rrh/', null=True, blank=True, verbose_name=_("Tableau Charges RRH"))
    rrh_reactions_file = models.FileField(upload_to='reactions_rrh/', null=True, blank=True, verbose_name=_("Fichier Réactions RRH"))
    rrh_screenshot = models.ImageField(upload_to='screenshots_rrh/', null=True, blank=True, verbose_name=_("Capture 3D RRH"))

    # Compiled final document (generated by backend assembler)
    compiled_docx = models.FileField(upload_to='ndc/', null=True, blank=True, verbose_name=_("Compiled DOCX"))
    compiled_pdf = models.FileField(upload_to='ndc/', null=True, blank=True, verbose_name=_("Compiled PDF"))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Calculation Job")
        verbose_name_plural = _("Calculation Jobs")
        ordering = ['-created_at']

    def __str__(self):
        return f"Job {self.id} [{self.calculation_type}] - {self.status}"


class GeneratedSiteNdc(models.Model):
    """
    Stores merged Site Note de Calcul documents generated for a user.
    Enables users to view and re-download past calculation reports in their account profile.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='site_ndcs', verbose_name=_("User"))
    site_name = models.CharField(max_length=255, blank=True, verbose_name=_("Nom du Site"))
    code_site = models.CharField(max_length=100, blank=True, verbose_name=_("Code Site"))
    client_name = models.CharField(max_length=255, blank=True, verbose_name=_("Client"))
    address = models.CharField(max_length=500, blank=True, verbose_name=_("Adresse"))
    operator = models.CharField(max_length=50, blank=True, verbose_name=_("Opérateur"))
    pdf_url = models.CharField(max_length=500, verbose_name=_("URL du PDF"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Date de Génération"))

    class Meta:
        verbose_name = _("Note de Calcul Générée")
        verbose_name_plural = _("Notes de Calcul Générées")
        ordering = ['-created_at']

    def __str__(self):
        return f"NDC - {self.code_site or self.site_name or 'Site'} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

