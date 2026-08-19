import httpx
import json

print('Testing Child Safety Tipline...')

# Minimal working payload
payload = {
    "is_anonymous": True,
    "screening": {
        "reporting_for": "someone_i_know",
        "recency": "lt_1_month",
        "time_zone": "IST (UTC+5:30)",
        "frequency": "one_time",
        "location_type": "online",
        "category_key": "grooming_sextortion",
        "feels_in_danger": "no"
    },
    "victim_identity_unknown": True
}

print('\nPayload:', json.dumps(payload, indent=2))

try:
    r = httpx.post('http://localhost:8000/api/child-safety/reports', 
                   json=payload, timeout=30)
    print('\nStatus Code:', r.status_code)
    
    if r.status_code == 201:
        result = r.json()
        print('\nSUCCESS!')
        print('Reference ID:', result['reference_id'])
        print('Status:', result['status'])
        print('Priority:', result['priority'])
        print('Escalated:', result['escalated'])
        print('Routed To:', result['routed_to'])
        print('Message:', result['message'])
        
        # Track
        ref_id = result['reference_id']
        track = httpx.get(f'http://localhost:8000/api/child-safety/reports/{ref_id}')
        print('\nTrack Result:')
        print(json.dumps(track.json(), indent=2))
    else:
        print('\nERROR:')
        print(r.text[:2000])
except Exception as e:
    print('EXCEPTION:', e)
    import traceback
    traceback.print_exc()

print('\n---')
print('Testing Full Report (with reporter info)...')

payload2 = {
    "is_anonymous": False,
    "reporter_name": "Concerned Parent",
    "reporter_email": "parent@example.com",
    "reporter_phone": "9876543210",
    "screening": {
        "reporting_for": "myself",
        "recency": "today",
        "incident_datetime": "2025-08-18T14:30:00",
        "time_zone": "IST (UTC+5:30)",
        "frequency": "one_time",
        "location_type": "both",
        "category_key": "pressuring_for_images",
        "feels_in_danger": "yes"
    },
    "victim_name": "Rahul",
    "victim_age": 14,
    "victim_identity_unknown": False,
    "platform": "WhatsApp",
    "urls_handles": "Phone: +91XXXXXXXXXX",
    "suspect_handle": "+91XXXXXXXXXX",
    "narrative": "Received inappropriate messages"
}

try:
    r2 = httpx.post('http://localhost:8000/api/child-safety/reports', 
                    json=payload2, timeout=30)
    print('\nStatus Code:', r2.status_code)
    
    if r2.status_code == 201:
        result = r2.json()
        print('\nSUCCESS!')
        print('Reference ID:', result['reference_id'])
        print('Escalated:', result['escalated'])
        print('Routed To:', result['routed_to'])
    else:
        print('\nERROR:', r2.text[:500])
except Exception as e:
    print('EXCEPTION:', e)
