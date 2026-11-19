import hmac
import logging
from django.conf import settings
from rest_framework import permissions

logger = logging.getLogger(__name__)


def _is_responsible_for_obj(user, obj) -> bool:
    if not user or not user.is_authenticated:
        return False
    if hasattr(obj, 'responsible_user'):
        return obj.responsible_user == user
    if hasattr(obj, 'equipment') and hasattr(obj.equipment, 'responsible_user'):
        return obj.equipment.responsible_user == user
    return False


class IsEngineerPermission(permissions.BasePermission):
    """
    Custom permission to only allow users with engineer role.
    """

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and
            request.user.profile.role and
            request.user.profile.role.name.lower() == 'engineer'
        )


class IsAdminOrEngineerPermission(permissions.BasePermission):
    """
    Custom permission to allow admins or engineers (with appropriate scope).
    Engineers can create equipment and manage their own assigned equipment.
    """

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser):
            return True

        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'profile') and
            request.user.profile.role and
            request.user.profile.role.name.lower() == 'engineer'
        )

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True

        if request.method in permissions.SAFE_METHODS:
            return True

        return _is_responsible_for_obj(request.user, obj)


class IsAdminOrResponsibleEngineerPermission(permissions.BasePermission):
    """
    Custom permission to allow admins or engineers responsible for specific equipment
    (including child specifications and terrain load calculations).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        return _is_responsible_for_obj(request.user, obj)


# Backwards-compatible alias (previously a verbatim duplicate)
IsResponsibleEngineerPermission = IsAdminOrResponsibleEngineerPermission


class IsRobotWorkerOrAdminPermission(permissions.BasePermission):
    """
    Protects robot worker callback endpoints (`complete`, `progress`, `WorkerControlView`).
    Allows authenticated staff/admin users OR callers presenting `X-Worker-Api-Key`
    matching `settings.ROBOT_WORKER_API_KEY`.
    If `ROBOT_WORKER_API_KEY` is not yet configured, logs a warning and permits
    callbacks for backward compatibility during rollout.
    """

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser):
            return True

        expected_key = getattr(settings, 'ROBOT_WORKER_API_KEY', '') or ''
        if not expected_key:
            logger.warning(
                "ROBOT_WORKER_API_KEY is not configured; allowing worker callback %s without API key.",
                request.path,
            )
            return True

        provided_key = (
            request.headers.get('X-Worker-Api-Key')
            or request.META.get('HTTP_X_WORKER_API_KEY')
            or ''
        )
        return bool(provided_key) and hmac.compare_digest(provided_key, expected_key)


class IsOwnerOrAdminPermission(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object or admin users.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True

        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'profile'):
            return obj.profile.user == request.user

        return False
