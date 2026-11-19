import logging
import os
import requests
from django.conf import settings
from django.db import close_old_connections
from .models import CalculationJob

logger = logging.getLogger(__name__)


def enqueue_task(func_path: str, *args, **kwargs):
    """
    Enqueue a background job on Django-Q2 (PostgreSQL ORM broker, zero Redis).
    Falls back cleanly to direct execution if Q_CLUSTER_SYNC is enabled or queueing fails.
    """
    try:
        from django_q.tasks import async_task
        return async_task(func_path, *args, **kwargs)
    except Exception as exc:
        logger.warning("Django-Q2 enqueue failed for %s (%s); executing inline.", func_path, exc)
        from django.utils.module_loading import import_string
        fn = import_string(func_path)
        return fn(*args, **kwargs)


def send_job_to_worker(job_id):
    """
    Pushes the calculation job to the Unified Windows FastAPI worker via HTTP POST.
    Runs inside django-q2 qcluster with clean DB connection lifecycle management.
    """
    close_old_connections()
    try:
        try:
            job = CalculationJob.objects.get(id=job_id)
        except CalculationJob.DoesNotExist:
            logger.error("send_job_to_worker failed: Job %s not found.", job_id)
            return False

        url = getattr(settings, 'ROBOT_WORKER_JOBS_URL', f"{settings.WORKER_BASE_URL.rstrip('/')}/api/jobs")

        payload = {
            "id": job.id,
            "input_data": dict(job.input_data or {})
        }

        if os.environ.get("INSPECT_MODE", "false").lower() == "true":
            payload["input_data"]["inspect_mode"] = True

        headers = {}
        api_key = getattr(settings, 'ROBOT_WORKER_API_KEY', '') or ''
        if api_key:
            headers['X-Worker-Api-Key'] = api_key

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code in (200, 201, 202):
                job.status = 'RUNNING'
                job.save(update_fields=['status'])
                logger.info("Dispatched Job %s to Unified Windows worker at %s.", job_id, url)
                return True
            else:
                job.status = 'FAILED'
                job.error_message = f"Windows Worker HTTP {response.status_code}: {response.text}"
                job.save(update_fields=['status', 'error_message'])
                logger.error("Worker rejected Job %s: HTTP %s", job_id, response.status_code)
                return False
        except requests.exceptions.RequestException as e:
            logger.error("Failed to connect to Windows worker for Job %s: %s", job_id, e)
            job.status = 'FAILED'
            job.error_message = f"Windows worker offline or unreachable: {str(e)}"
            job.save(update_fields=['status', 'error_message'])
            return False
    finally:
        close_old_connections()


def compile_job_documents_task(job_id):
    """
    Background Django-Q2 task to compile DOCX/PDF documents after a Robot job completes,
    keeping the worker callback HTTP handler fast and non-blocking.
    """
    close_old_connections()
    try:
        from .services import assemble_ndc_document
        assemble_ndc_document(job_id)
    except Exception:
        logger.exception("Background document compilation failed for Job %s", job_id)
    finally:
        close_old_connections()
