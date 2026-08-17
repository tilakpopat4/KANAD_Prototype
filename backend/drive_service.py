import os
import json
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
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
        
    return build('drive', 'v3', credentials=creds)

def upload_to_drive(file_bytes: bytes, filename: str, mime_type: str) -> str:
    """
    Uploads a file to Google Drive and makes it public.
    Returns the public direct view link for the image.
    """
    service = get_drive_service()
    
    file_metadata = {'name': filename}
    folder_id = os.environ.get("DRIVE_FOLDER_ID")
    if folder_id:
        file_metadata['parents'] = [folder_id]
        
    media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=True)
    
    # Upload file
    file = service.files().create(
        body=file_metadata, 
        media_body=media, 
        fields='id'
    ).execute()
    
    file_id = file.get('id')
    
    # Make it public
    permission = {
        'type': 'anyone',
        'role': 'reader',
    }
    service.permissions().create(
        fileId=file_id,
        body=permission,
        fields='id'
    ).execute()
    
    # Direct view link for images in Google Drive
    return f"https://drive.google.com/uc?export=view&id={file_id}"
