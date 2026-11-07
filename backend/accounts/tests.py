from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import TEST_PASSWORD, make_user


class AuthApiTests(APITestCase):
    def test_register_returns_tokens_and_customer_role(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "New.User@Example.com",
                "first_name": "New",
                "last_name": "User",
                "password": TEST_PASSWORD,
                "password_confirm": TEST_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["email"], "new.user@example.com")
        self.assertEqual(response.data["user"]["role"], "customer")
        self.assertIn("printora_access", response.cookies)
        self.assertIn("printora_refresh", response.cookies)

    def test_register_rejects_duplicate_email_case_insensitively(self):
        make_user(email="taken@example.com")
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "TAKEN@example.com",
                "password": TEST_PASSWORD,
                "password_confirm": TEST_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_rejects_mismatched_passwords(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "mismatch@example.com",
                "password": TEST_PASSWORD,
                "password_confirm": "different-pass-123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_me_and_profile_update(self):
        make_user(email="shopper@example.com", first_name="Shopper")
        login = self.client.post(
            "/api/auth/login/", {"email": "SHOPPER@example.com", "password": TEST_PASSWORD}, format="json"
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertEqual(login.data["user"]["email"], "shopper@example.com")
        self.assertIn("printora_access", login.cookies)

        me = self.client.get("/api/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["email"], "shopper@example.com")

        update = self.client.patch(
            "/api/auth/me/",
            {"first_name": "Updated", "profile": {"phone": "+1 555 0100", "city": "Portland"}},
            format="json",
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data["first_name"], "Updated")
        self.assertEqual(update.data["profile"]["phone"], "+1 555 0100")
        self.assertEqual(update.data["profile"]["city"], "Portland")

    def test_login_rejects_bad_password(self):
        make_user(email="shopper2@example.com")
        response = self.client.post(
            "/api/auth/login/", {"email": "shopper2@example.com", "password": "wrong-password"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_authentication(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_customer_list_is_role_protected(self):
        customer = make_user(email="customer@example.com")
        self.client.force_authenticate(customer)
        denied = self.client.get("/api/auth/admin/customers/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        admin = make_user(email="admin@example.com", role="admin")
        self.client.force_authenticate(admin)
        allowed = self.client.get("/api/auth/admin/customers/")
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        emails = [row["email"] for row in allowed.data["results"]]
        self.assertIn("customer@example.com", emails)
        self.assertNotIn("admin@example.com", emails)

    def test_superuser_gets_admin_role_and_is_excluded_from_customers(self):
        from accounts.models import User

        superuser = User.objects.create_superuser(
            username="super@example.com", email="super@example.com", password=TEST_PASSWORD
        )
        self.assertEqual(superuser.role, User.Role.ADMIN)

        make_user(email="regular@example.com")
        self.client.force_authenticate(superuser)
        res = self.client.get("/api/auth/admin/customers/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        emails = [row["email"] for row in res.data["results"]]
        self.assertIn("regular@example.com", emails)
        self.assertNotIn("super@example.com", emails)
