#!/usr/bin/env python3
"""
DigiLocker Flow Test Script
============================
Tests the complete DigiLocker verification flow:
1. Start verification → Get authorization_url
2. User opens URL in browser and completes consent + OTP
3. Poll for status until verified

Usage:
    python test_digilocker_flow.py
"""

import httpx
import time
import json
import webbrowser
from urllib.parse import urljoin

# Configuration
BASE_URL = "http://localhost:8000"
DIGILOCKER_ENDPOINT = f"{BASE_URL}/api/digilocker"

def start_verification():
    """Step 1: Start DigiLocker verification and get authorization URL"""
    print("=" * 60)
    print("STEP 1: Start DigiLocker Verification")
    print("=" * 60)
    
    try:
        response = httpx.post(f"{DIGILOCKER_ENDPOINT}/start", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Verification started successfully!")
            print(f"   Verify Token: {data.get('verify_token', 'N/A')}")
            print(f"   Simulated Mode: {data.get('simulated', False)}")
            
            if data.get('authorization_url'):
                auth_url = data['authorization_url']
                print(f"\n🔗 Authorization URL: {auth_url}")
                print(f"\n📱 ACTION REQUIRED:")
                print(f"   1. Open the URL above in your browser")
                print(f"   2. Complete the DigiLocker consent")
                print(f"   3. Enter the test OTP")
                print(f"   4. Then return here and press Enter to continue polling...")
                
                # Try to open browser automatically
                try:
                    webbrowser.open(auth_url)
                    print(f"\n✅ Attempted to open browser automatically")
                except Exception as e:
                    print(f"\n⚠️ Could not open browser automatically: {e}")
                
                return data.get('verify_token')
            else:
                print(f"\n⚠️ No authorization_url returned")
                print(f"   Response: {json.dumps(data, indent=2)}")
                return None
        else:
            print(f"\n❌ Failed to start verification")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return None

def complete_simulated(token, otp="123456"):
    """Complete verification in simulated mode"""
    print(f"\n📝 Completing simulated verification...")
    try:
        response = httpx.post(
            f"{DIGILOCKER_ENDPOINT}/simulate-complete",
            json={"verify_token": token, "otp": otp},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Simulated completion: {data}")
            return True
        else:
            print(f"❌ Simulated completion failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def check_status(token):
    """Check verification status"""
    try:
        response = httpx.get(f"{DIGILOCKER_ENDPOINT}/status/{token}", timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception as e:
        print(f"❌ Error checking status: {e}")
        return None

def poll_status(token, max_attempts=30, interval=3):
    """Step 3: Poll for verification status until verified or max attempts"""
    print("\n" + "=" * 60)
    print("STEP 3: Polling for Verification Status")
    print("=" * 60)
    print(f"Token: {token}")
    print(f"Max attempts: {max_attempts}, Interval: {interval}s\n")
    
    for attempt in range(1, max_attempts + 1):
        print(f"   Poll #{attempt}: Checking status...", end=" ")
        status_data = check_status(token)
        
        if status_data:
            status = status_data.get('status', 'unknown')
            print(f"[{status.upper()}]")
            
            if status == 'verified':
                print(f"\n✅ VERIFICATION COMPLETE!")
                print(f"   Status: {status}")
                print(f"   Name: {status_data.get('name', 'N/A')}")
                print(f"   Aadhaar: {status_data.get('aadhaar', 'N/A')}")
                print(f"   Verified At: {status_data.get('verified_at', 'N/A')}")
                return True
            elif status == 'failed':
                print(f"\n❌ VERIFICATION FAILED!")
                print(f"   Error: {status_data.get('error', 'Unknown error')}")
                return False
            elif status == 'expired':
                print(f"\n⏰ VERIFICATION EXPIRED!")
                return False
            else:
                # Still pending - continue polling
                if attempt < max_attempts:
                    print(f"   Waiting {interval}s before next poll...")
                    time.sleep(interval)
        else:
            print("[ERROR - Could not check status]")
            return False
    
    print(f"\n⏰ Max attempts reached ({max_attempts})")
    return False

def main():
    """Main test flow"""
    print("\n" + "=" * 60)
    print("   DigiLocker Integration Test")
    print("   Kanad Shield - Sandbox Mode")
    print("=" * 60 + "\n")
    
    # Step 1: Start verification
    token = start_verification()
    if not token:
        return
    
    # Wait for user input
    print("\n" + "-" * 60)
    input("\nPress Enter after completing the browser flow...")
    print("-" * 60)
    
    # Step 3: Poll for status
    success = poll_status(token)
    
    # Summary
    print("\n" + "=" * 60)
    print("   TEST SUMMARY")
    print("=" * 60)
    if success:
        print("✅ DigiLocker verification flow completed successfully!")
    else:
        print("❌ DigiLocker verification flow failed or timed out")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
