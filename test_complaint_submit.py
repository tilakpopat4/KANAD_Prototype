#!/usr/bin/env python3
"""Test the fraud complaint submission end-to-end"""
import httpx
import json

def test_complaint_flow():
    print("="*60)
    print("TESTING FRAUD COMPLAINT SUBMISSION")
    print("="*60)
    
    # Step 1: Get DigiLocker token
    print("\nStep 1: Starting DigiLocker verification...")
    r1 = httpx.post('http://localhost:8000/api/digilocker/start')
    print(f"  Response: {r1.status_code}")
    
    if r1.status_code != 200:
        print(f"  Error: {r1.text}")
        return False
        
    data = r1.json()
    token = data['verify_token']
    print(f"  Token: {token}")
    print(f"  Simulated: {data['simulated']}")
    
    # Step 2: Complete verification
    print("\nStep 2: Completing DigiLocker verification...")
    r2 = httpx.post('http://localhost:8000/api/digilocker/simulate-complete', 
        json={'verify_token': token, 'otp': '123456'})
    print(f"  Response: {r2.status_code}")
    
    if r2.status_code != 200:
        print(f"  Error: {r2.text}")
        return False
        
    comp = r2.json()
    print(f"  Status: {comp['status']}")
    print(f"  Verified name: {comp['verified_name']}")
    
    # Step 3: Submit complaint
    print("\nStep 3: Submitting fraud complaint...")
    complaint = {
        'filer_is_complainant': True,
        'filer_name': 'John Doe',
        'filer_phone': '9876543210',
        'filer_email': 'john@example.com',
        'complainant_name': 'John Doe',
        'address': '123 Test St',
        'city': 'Mumbai',
        'country': 'India',
        'state': 'Maharashtra',
        'zip_code': '400001',
        'complainant_phone': '9876543210',
        'complainant_email': 'john@example.com',
        'incident_description': 'Test fraud incident description here',
        'transactions': [],
        'subjects': [],
        'digilocker_verify_token': token
    }
    
    r3 = httpx.post('http://localhost:8000/api/fraud-complaints', json=complaint)
    print(f"  Response: {r3.status_code}")
    
    if r3.status_code == 201:
        result = r3.json()
        print("\n  COMPLAINT SUBMITTED SUCCESSFULLY!")
        print(f"  Reference ID: {result['reference_id']}")
        print(f"  Status: {result['status']}")
        print(f"  Priority: {result['priority']}")
        print(f"  Verified identity: {result['verified_identity']}")
        
        # Step 4: Track the complaint
        print("\nStep 4: Tracking complaint...")
        ref_id = result['reference_id']
        r4 = httpx.get(f'http://localhost:8000/api/fraud-complaints/{ref_id}')
        print(f"  Response: {r4.status_code}")
        if r4.status_code == 200:
            track = r4.json()
            print(f"  Tracked Status: {track['status']}")
            print(f"  Priority: {track['priority']}")
        else:
            print(f"  Error: {r4.text}")
        
        return True
    else:
        print(f"  Error: {r3.text}")
        return False

if __name__ == "__main__":
    success = test_complaint_flow()
    print("\n" + "="*60)
    if success:
        print("ALL TESTS PASSED")
    else:
        print("TESTS FAILED")
    print("="*60)
