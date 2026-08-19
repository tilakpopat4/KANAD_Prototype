#!/usr/bin/env python3
"""Start server with env vars and test DigiLocker flow"""
import os
import subprocess
import sys

# Load .env file
print("Loading environment from .env file...")
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                key, val = line.split('=', 1)
                os.environ[key] = val
                # Mask secrets for display
                if 'SECRET' in key or 'JWT' in key or 'KEY' in key:
                    display_val = val[:20] + '...' if len(val) > 20 else val
                else:
                    display_val = val
                print(f"  {key}={display_val}")
else:
    print(f"WARNING: .env file not found at {env_path}")

print(f"\nDIGILOCKER_PROVIDER: {os.getenv('DIGILOCKER_PROVIDER', 'not set')}")
print(f"FORENSYNC_JWT_SECRET set: {bool(os.getenv('FORENSYNC_JWT_SECRET'))}")
print(f"FORENSYNC_REFRESH_SECRET set: {bool(os.getenv('FORENSYNC_REFRESH_SECRET'))}")

print("\n" + "="*60)
print("Starting Uvicorn server...")
print("="*60)
print("URL: http://localhost:8000")
print("API Docs: http://localhost:8000/docs")
print("Press CTRL+C to stop")
print("="*60 + "\n")

# Start the server
subprocess.run([
    sys.executable, '-m', 'uvicorn', 
    'api.main:app', 
    '--reload', 
    '--host', '0.0.0.0', 
    '--port', '8000',
    '--log-level', 'info'
])
