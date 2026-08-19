import httpx
import json

print('Testing Women Safety / Harassment Reporting...')

# Test 1: Get resources
print('\n1. Getting resources...')
r1 = httpx.get('http://localhost:8000/api/women-safety/resources')
print('   Status:', r1.status_code)
if r1.status_code == 200:
    data = r1.json()
    print('   Support helplines:', len(data.get('support', [])))
    print('   Incident types:', len(data.get('incident_types', [])))
    for t in data.get('incident_types', []):
        print(f'      - {t["key"]}: {t["label"]}')

# Test 2: Submit anonymous report (minimal)
print('\n2. Submitting anonymous report...')
payload = {
    "incident_type": "online_harassment",
    "incident_location": "Social Media (Instagram)",
    "description": "Receiving abusive messages and threats from unknown accounts",
    "is_anonymous": True
}

r2 = httpx.post('http://localhost:8000/api/women-safety/reports', json=payload)
print('   Status:', r2.status_code)
if r2.status_code == 201:
    result = r2.json()
    print('   SUCCESS!')
    print('   Reference ID:', result['reference_id'])
    print('   Status:', result['status'])
    print('   Message:', result['message'])
else:
    print('   ERROR:', r2.text[:500])

# Test 3: Submit full report
print('\n3. Submitting full report...')
payload2 = {
    "incident_type": "stalking",
    "incident_datetime": "2025-08-18T14:30:00",
    "incident_location": "Online and Offline - Residential area",
    "platform": "Facebook, WhatsApp",
    "description": "Someone has been stalking me online and now appearing near my home. Started with online messages, now following me in real life.",
    "evidence_links": "https://example.com/screenshots",
    "evidence_notes": "Have screenshots of messages and CCTV footage",
    "reporter_name": "Jane Doe",
    "reporter_email": "jane@example.com",
    "reporter_phone": "9876543210",
    "report_relation": "Self - Victim",
    "suspect_name": "Unknown",
    "suspect_handle": "@creepy_user123",
    "suspect_relationship": "Stalker - Unknown to me",
    "narrative": "Started with online messages, now following me in real life",
    "is_anonymous": False,
    "schema_version": "fir_citizen_intake_v1"
}

r3 = httpx.post('http://localhost:8000/api/women-safety/reports', json=payload2)
print('   Status:', r3.status_code)
if r3.status_code == 201:
    result = r3.json()
    print('   SUCCESS!')
    print('   Reference ID:', result['reference_id'])
    print('   Status:', result['status'])
    print('   Schema Version:', result['schema_version'])
else:
    print('   ERROR:', r3.text[:500])

print('\n--- Tests Complete ---')
