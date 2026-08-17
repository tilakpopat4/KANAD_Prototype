import os
import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_credentials():
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    creds_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    
    creds = None
    if creds_json:
        try:
            creds_info = json.loads(creds_json)
            creds = service_account.Credentials.from_service_account_info(creds_info, scopes=SCOPES)
        except json.JSONDecodeError:
            pass
    elif creds_file and os.path.exists(creds_file):
        creds = service_account.Credentials.from_service_account_file(creds_file, scopes=SCOPES)
        
    if not creds:
        raise ValueError("Google Drive credentials not found. Please set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON in your .env file.")
        
    # Ensure token is valid
    if not creds.valid:
        creds.refresh(Request())
        
    return creds

def upload_to_drive(file_bytes: bytes, filename: str, mime_type: str) -> str:
    """
    Uploads a file to Google Drive and makes it public using the REST API.
    Returns the public direct view link for the image.
    """
    creds = get_credentials()
    
    # 1. Upload the file
    upload_url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
    headers = {
        "Authorization": f"Bearer {creds.token}"
    }
    
    file_metadata = {'name': filename}
    folder_id = os.environ.get("DRIVE_FOLDER_ID")
    if folder_id:
        file_metadata['parents'] = [folder_id]
        
    files = {
        'metadata': ('', json.dumps(file_metadata), 'application/json'),
        'file': (filename, file_bytes, mime_type)
    }
    
    response = requests.post(upload_url, headers=headers, files=files)
    response.raise_for_status()
    
    file_id = response.json().get('id')
    
    # 2. Make it public
    permission_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions"
    permission_data = {
        'type': 'anyone',
        'role': 'reader',
    }
    
    perm_response = requests.post(permission_url, headers=headers, json=permission_data)
    perm_response.raise_for_status()
    
    # Direct view link for images in Google Drive
    return f"https://drive.google.com/uc?export=view&id={file_id}"
