from django.conf import settings
from django.db.models import Count
from django.middleware.csrf import get_token
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from core.permissions import IsAdminRole

from .models import User, UserProfile
from .serializers import (
    AdminUserSerializer,
    EmailTokenObtainPairSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
)


def _set_auth_cookies(response, access, refresh):
    response.set_cookie(
        settings.AUTH_ACCESS_COOKIE,
        access,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE,
        refresh,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )
    return response


def _clear_auth_cookies(response):
    response.delete_cookie(settings.AUTH_ACCESS_COOKIE, path="/")
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE, path="/")
    return response


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        response = Response(
            {"user": UserSerializer(user).data}, status=status.HTTP_201_CREATED
        )
        return _set_auth_cookies(response, str(refresh.access_token), str(refresh))


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        response = Response({"user": UserSerializer(user).data})
        return _set_auth_cookies(response, serializer.validated_data["access"], serializer.validated_data["refresh"])


class CookieTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        if "refresh" not in request.data:
            request.data["refresh"] = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE, "")
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and "access" in response.data:
            response = _set_auth_cookies(
                response, response.data["access"], request.COOKIES.get(settings.AUTH_REFRESH_COOKIE, "")
            )
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"detail": "Logged out."})
        return _clear_auth_cookies(response)


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        allowed = {"first_name", "last_name", "username"}
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile_data = request.data.get("profile")
        if isinstance(profile_data, dict):
            profile_serializer = ProfileSerializer(profile, data=profile_data, partial=True)
            profile_serializer.is_valid(raise_exception=True)
            profile_serializer.save()

        return Response(UserSerializer(user).data)


class AdminCustomerListView(generics.ListAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = AdminUserSerializer
    queryset = (
        User.objects.filter(role="customer", is_superuser=False)
        .annotate(
            design_count=Count("designs", distinct=True),
            order_count=Count("orders", distinct=True),
        )
        .order_by("-date_joined")
    )

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(email__icontains=search)
        return qs


class AdminCustomerDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = AdminUserSerializer
    queryset = User.objects.filter(role="customer", is_superuser=False)
