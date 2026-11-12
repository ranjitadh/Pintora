from django.contrib.auth import get_user_model

User = get_user_model()

def create_admin_user():
    """Create a superuser for tests if it doesn't exist.
    This function can be imported in test modules or called from a test
    `setUpTestData` method.
    """
    if not User.objects.filter(username="admin").exists():
        User.objects.create_superuser(username="admin", email="admin@example.com", password="admin123")
    return User.objects.get(username="admin")

