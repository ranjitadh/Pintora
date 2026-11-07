from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """Allows access only to administrator or production staff accounts."""

    message = "Administrator access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.role in ("admin", "staff"))
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    message = "You do not have access to this object."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.role in ("admin", "staff"):
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return owner == user
