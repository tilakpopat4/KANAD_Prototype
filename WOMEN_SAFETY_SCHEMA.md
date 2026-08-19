# Women Safety / Harassment - API & Schema Reference

## Overview
Anonymous or identified reporting of women safety incidents and harassment. Reports are stored for review by support teams.

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/women-safety/resources` | Get helplines, incident types | No |
| POST | `/api/women-safety/reports` | Submit report | No |

---

## Request Schema - WomenSafetyReportCreate

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `incident_type` | string | Type of incident (see Incident Types) |
| `incident_location` | string | Where did it happen? |
| `description` | string | Detailed description (10-5000 chars) |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `incident_datetime` | string\|null | null | ISO datetime of incident |
| `platform` | string\|null | null | Platform where it occurred |
| `evidence_links` | string\|null | null | URLs to evidence |
| `evidence_notes` | string\|null | null | Notes about evidence |
| `reporter_name` | string\|null | null | Reporter name (null if anonymous) |
| `reporter_email` | string\|null | null | Reporter email (null if anonymous) |
| `reporter_phone` | string\|null | null | Reporter phone (null if anonymous) |
| `report_relation` | string\|null | null | Relationship to victim |
| `suspect_name` | string\|null | null | Suspect name |
| `suspect_handle` | string\|null | null | Suspect online handle |
| `suspect_relationship` | string\|null | null | Suspect relationship |
| `narrative` | string\|null | null | Same as description |
| `is_anonymous` | boolean | true | Anonymous submission flag |
| `schema_version` | string | "fir_citizen_intake_v1" | Schema version |
| `form_payload` | object\|null | null | Full form snapshot |

---

## Incident Types

| Key | Label |
|-----|-------|
| `online_harassment` | Online harassment or abuse |
| `stalking` | Stalking or repeated threatening contact |
| `blackmail` | Blackmail / extortion / sextortion |
| `impersonation` | Fake profile / impersonation |
| `image_abuse` | Explicit image or deepfake abuse |
| `other` | Other threat or violence |

---

## Helpline Resources (from `/api/women-safety/resources`)

```json
{
  "support": [
    {"label": "Women Helpline", "detail": "Call 181 for immediate women support"},
    {"label": "Emergency", "detail": "Call 112 if in immediate danger"},
    {"label": "National Cyber Crime Helpline", "detail": "Call 1930 for cyber-crime support"}
  ],
  "incident_types": [
    {"key": "online_harassment", "label": "Online harassment or abuse"},
    {"key": "stalking", "label": "Stalking or repeated threatening contact"},
    {"key": "blackmail", "label": "Blackmail / extortion / sextortion"},
    {"key": "impersonation", "label": "Fake profile / impersonation"},
    {"key": "image_abuse", "label": "Explicit image or deepfake abuse"},
    {"key": "other", "label": "Other threat or violence"}
  ]
}
```

---

## Response Schema

```json
{
  "reference_id": "WSR-2026-A1B2C3D4",
  "message": "Your women safety concern has been recorded...",
  "status": "submitted",
  "schema_version": "fir_citizen_intake_v1",
  "payload_json": {...}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reference_id` | string | WSR-YYYY-XXXXXXXX format |
| `message` | string | Confirmation message |
| `status` | string | `"submitted"` |
| `schema_version` | string | Schema version used |
| `payload_json` | object | Normalized FIR-style payload |

---

## Sample JSON (Anonymous - Minimal)

```json
{
  "incident_type": "online_harassment",
  "incident_location": "Social Media (Instagram)",
  "description": "Receiving abusive messages and threats from unknown accounts",
  "is_anonymous": true
}
```

---

## Sample JSON (Full Report)

```json
{
  "incident_type": "stalking",
  "incident_datetime": "2025-08-18T14:30:00",
  "incident_location": "Online and Offline - Residential area",
  "platform": "Facebook, WhatsApp",
  "description": "Someone has been stalking me online and now appearing near my home",
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
  "is_anonymous": false,
  "schema_version": "fir_citizen_intake_v1"
}
```

---

## Legal Mapping

All women safety reports are tagged with:
- **BNS** (Bharatiya Nyaya Sanhita)
- **IT Act 67B** (Cyber offenses)
- **POSH / harassment laws**

---

## Test Command

```python
import httpx

# Minimal report
payload = {
    "incident_type": "online_harassment",
    "incident_location": "Social Media",
    "description": "Receiving abusive messages",
    "is_anonymous": True
}

r = httpx.post("http://localhost:8000/api/women-safety/reports", json=payload)
print(r.status_code)
print(r.json())
```
