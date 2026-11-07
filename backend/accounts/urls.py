from django.urls import path

from .views import (
    AdminCustomerDetailView,
    AdminCustomerListView,
    CookieTokenRefreshView,
    CsrfTokenView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", CookieTokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("csrf/", CsrfTokenView.as_view(), name="csrf-token"),
    path("me/", MeView.as_view(), name="me"),
    path("admin/customers/", AdminCustomerListView.as_view(), name="admin-customers"),
    path("admin/customers/<int:pk>/", AdminCustomerDetailView.as_view(), name="admin-customer-detail"),
]
