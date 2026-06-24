import os
import requests
import base64
from django.conf import settings

def get_aps_token():
    """
    Retrieves a 2-legged access token from the Autodesk Platform Services (APS) API.
    Uses credentials from environment variables.
    """
    client_id = os.getenv('APS_CLIENT_ID')
    client_secret = os.getenv('APS_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        raise ValueError("APS credentials not found in environment variables.")

    url = "https://developer.api.autodesk.com/authentication/v2/token"
    
    auth_str = f"{client_id}:{client_secret}"
    b64_auth_str = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': f'Basic {b64_auth_str}'
    }
    
    data = {
        'grant_type': 'client_credentials',
        'scope': 'data:read data:write data:create'
    }
    
    response = requests.post(url, headers=headers, data=data)
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to obtain token: {response.status_code} {response.text}")
