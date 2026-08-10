import requests
from django.conf import settings
from .models import CalculationJob

def send_job_to_worker(job_id):
    """
    Fetches the calculation job and pushes it to the FastAPI worker via HTTP POST.
    Designed to run asynchronously using django-q2 to avoid blocking the main server threads.
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
    
    import os
    if os.environ.get("INSPECT_MODE", "false").lower() == "true":
        payload["input_data"]["inspect_mode"] = True
    
    try:
        # Timeout set to 5s since we only push to the queue
        response = requests.post(url, json=payload, timeout=5.0)
        
        if response.status_code in [200, 201, 202]:
            print(f"Successfully dispatched Job {job_id} to worker at {url}.")
            return True
        else:
            raise Exception(f"Worker returned HTTP {response.status_code}: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"Failed to connect to worker for Job {job_id}: {e}")
        # Note: Depending on Q_CLUSTER settings, returning False / raising exception 
        # may trigger a retry. Raising is better for automatic retries.
        raise Exception(f"Failed to dispatch to worker: {e}")
