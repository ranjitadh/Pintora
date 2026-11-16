from django.core.management import call_command
from django.core.management.base import BaseCommand

from catalog.models import Product


class Command(BaseCommand):
    help = "Seed the demo catalog only when no products exist (safe for first deploys)."

    def handle(self, *args, **options):
        if Product.objects.exists():
            self.stdout.write("Catalog already has products; skipping demo seed.")
            return

        self.stdout.write("Empty catalog detected; seeding demo storefront data.")
        call_command("seed_demo", no_demo_customer=True)
