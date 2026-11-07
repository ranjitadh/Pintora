from celery import shared_task

from .services import process_generated_file


@shared_task(name="production.generate_export")
def generate_export_task(file_id):
    return process_generated_file(str(file_id))
