from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AdminCustomerDetailView, AdminCustomerListView, LoginView, MeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("admin/customers/", AdminCustomerListView.as_view(), name="admin-customers"),
    path("admin/customers/<int:pk>/", AdminCustomerDetailView.as_view(), name="admin-customer-detail"),
]
