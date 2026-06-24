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
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("User Profile")
        verbose_name_plural = _("User Profiles")

    def __str__(self):
        return f"{self.user.username}'s Profile"


class CalculationJob(models.Model):
    """
    Stores calculation jobs sent to the Windows Server via APS.
    Acts as a catalog to cache results if the same input is requested again.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='calculation_jobs', verbose_name=_("User"))
    input_hash = models.CharField(max_length=64, db_index=True, verbose_name=_("Input Hash"))
    input_data = models.JSONField(verbose_name=_("Input Data"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name=_("Status"))
    result_data = models.JSONField(null=True, blank=True, verbose_name=_("Result Data"))
    error_message = models.TextField(blank=True, null=True, verbose_name=_("Error Message"))
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated At"))

    class Meta:
        verbose_name = _("Calculation Job")
        verbose_name_plural = _("Calculation Jobs")
        ordering = ['-created_at']

    def __str__(self):
        return f"Job {self.id} - {self.status}"
