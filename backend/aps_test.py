import os
import requests
import base64
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

APS_CLIENT_ID = os.getenv('APS_CLIENT_ID')
APS_CLIENT_SECRET = os.getenv('APS_CLIENT_SECRET')
APS_CALLBACK_URL = os.getenv('APS_CALLBACK_URL')

def get_2legged_token():
    print("Testing APS API connection...")
    if not APS_CLIENT_ID or not APS_CLIENT_SECRET:
        print("❌ Error: APS credentials not found in environment variables.")
        return

    # APS Authentication v2 endpoint
    url = "https://developer.api.autodesk.com/authentication/v2/token"
    
    # Create the authorization header
    auth_str = f"{APS_CLIENT_ID}:{APS_CLIENT_SECRET}"
    b64_auth_str = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': f'Basic {b64_auth_str}'
    }
    
    # Request generic scope for data reading/writing
    data = {
        'grant_type': 'client_credentials',
        'scope': 'data:read data:write data:create'
    }
    
    print(f"Using Client ID: {APS_CLIENT_ID[:5]}...{APS_CLIENT_ID[-5:]}")
    print(f"Configured Callback URL: {APS_CALLBACK_URL}")
    print("Requesting 2-legged access token...")
    
    try:
        response = requests.post(url, headers=headers, data=data)
        
        if response.status_code == 200:
            token_info = response.json()
            print("\n✅ Success! Obtained Access Token.")
            print(f"Token Type: {token_info.get('token_type')}")
            print(f"Expires In: {token_info.get('expires_in')} seconds")
            token = token_info.get('access_token', '')
            print(f"Access Token: {token[:10]}...{token[-10:]}")
        else:
            print("\n❌ Failed to obtain token.")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"\n❌ Error connecting to APS API: {e}")

if __name__ == "__main__":
    get_2legged_token()
