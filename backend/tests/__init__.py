from .fixtures.admin_user import create_admin_user

# Ensure admin user exists for any test that needs authentication.
create_admin_user()

