from django.core.management import call_command
from django.core.management.base import BaseCommand

from catalog.models import Product


class Command(BaseCommand):
    help = "Seed the demo catalog. Clears existing products first so the demo catalog always loads."

    def handle(self, *args, **options):
        Product.objects.all().delete()
        self.stdout.write("Cleared existing products. Seeding demo storefront data…")
        call_command("seed_demo", no_demo_customer=True)
