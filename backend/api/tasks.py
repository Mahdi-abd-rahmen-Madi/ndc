import os
import requests
from django.conf import settings
from .models import CalculationJob

def send_job_to_worker(job_id):
    """
    Directly pushes the calculation job to the Windows FastAPI worker via HTTP POST.
    Updates the job status directly without database polling queues.
    """
    try:
        job = CalculationJob.objects.get(id=job_id)
    except CalculationJob.DoesNotExist:
        print(f"send_job_to_worker failed: Job {job_id} not found.")
        return False

    url = f"{settings.WORKER_BASE_URL.rstrip('/')}/api/jobs"
    
    payload = {
        "id": job.id,
        "input_data": job.input_data or {}
    }
    
    if os.environ.get("INSPECT_MODE", "false").lower() == "true":
        payload["input_data"]["inspect_mode"] = True
    
    try:
        # Push to the Windows worker (timeout 10s for the HTTP handshake)
        response = requests.post(url, json=payload, timeout=10.0)
        
        if response.status_code in [200, 201, 202]:
            job.status = 'PROCESSING'
            job.save(update_fields=['status'])
            print(f"Successfully dispatched Job {job_id} to Windows worker.")
            return True
        else:
            job.status = 'FAILED'
            job.error_message = f"Windows Worker HTTP {response.status_code}: {response.text}"
            job.save(update_fields=['status', 'error_message'])
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Failed to connect to Windows worker for Job {job_id}: {e}")
        job.status = 'FAILED'
        job.error_message = f"Windows worker offline or unreachable: {str(e)}"
        job.save(update_fields=['status', 'error_message'])
        return False
