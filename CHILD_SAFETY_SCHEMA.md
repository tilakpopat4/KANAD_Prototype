# Child Safety Tipline - API & Schema Reference

## Overview
Anonymous or identified reporting of child safety incidents. Reports routed to I4C, Police, CWC.

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/child-safety/resources` | Get helplines, categories | No |
| POST | `/api/child-safety/reports` | Submit report | No |
| GET | `/api/child-safety/reports/{ref}` | Track report | No |

---

## Request Schema

### Root Fields

| Field | Req | Type | Default |
|-------|-----|------|---------|
| `is_anonymous` | ✓ | boolean | true |
| `reporter_name` | - | string\|null | null |
| `reporter_email` | - | string\|null | null |
| `reporter_phone` | - | string\|null | null |
| `screening` | ✓ | object | - |
| `victim_name` | - | string\|null | null |
| `victim_age` | - | integer\|null | null |
| `victim_identity_unknown` | ✓ | boolean | false |
| `platform` | - | string\|null | null |
| `platform_other` | - | string\|null | null |
| `urls_handles` | - | string\|null | null |
| `suspect_name` | - | string\|null | null |
| `suspect_handle` | - | string\|null | null |
| `suspect_relationship` | - | string\|null | null |
| `narrative` | - | string\|null | null |

---

## Screening Object (REQUIRED)

| Field | Req | Type | Allowed Values |
|-------|-----|------|----------------|
| `reporting_for` | ✓ | string | `myself`, `someone_i_know`, `url_unknown_victim`, `other_activity` |
| `recency` | ✓ | string | `not_yet`, `today`, `lt_1_month`, `1_6_months`, `6_12_months`, `over_year`, `unknown` |
| `incident_datetime` | - | string\|null | ISO datetime or null |
| `time_zone` | ✓ | string | `"IST (UTC+5:30)"` |
| `frequency` | ✓ | string | `one_time`, `ongoing` |
| `location_type` | ✓ | string | `online`, `offline`, `both` |
| `category_key` | ✓ | string | See Category Keys |
| `feels_in_danger` | ✓ | string | `yes`, `no`, `unknown` |

---

## Category Keys

| Key | Label | Legal |
|-----|-------|-------|
| `csam_possession` | Sharing/possession of sexual images | IT Act 67B, POCSO Act, BNS |
| `grooming_sextortion` | Online grooming / sextortion | POCSO Act, IT Act 67B, BNS |
| `live_streamed_abuse` | Live-streamed abuse | POCSO Act, IT Act 67B |
| `child_trafficking` | Child sex trafficking | BNS, POCSO Act |
| `online_solicitation` | Child solicited online | POCSO Act, IT Act 67B |
| `pressuring_for_images` | Adult pressuring child for images | POCSO Act, IT Act 67B |
| `other_enticement` | Other exploitation | POCSO Act |
| `something_else` | Something else | - |

---

## Response Schema

```json
{
  "reference_id": "CSR-2026-A1B2C3D4",
  "status": "submitted",
  "priority": "high",
  "escalated": false,
  "routed_to": ["I4C_NCRP", "LOCAL_POLICE", "CWC"],
  "danger_message": null,
  "message": "Your report has been received..."
}
```

---

## Sample JSON (Anonymous - Minimal)

```json
{
  "is_anonymous": true,
  "screening": {
    "reporting_for": "someone_i_know",
    "recency": "lt_1_month",
    "time_zone": "IST (UTC+5:30)",
    "frequency": "one_time",
    "location_type": "online",
    "category_key": "grooming_sextortion",
    "feels_in_danger": "no"
  },
  "victim_identity_unknown": true
}
```

---

## Sample JSON (Full Report)

```json
{
  "is_anonymous": false,
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
  "victim_identity_unknown": false,
  "platform": "WhatsApp",
  "urls_handles": "Phone: +91XXXXXXXXXX",
  "suspect_handle": "+91XXXXXXXXXX",
  "narrative": "Received inappropriate messages"
}
```

---

## Routing Rules

| Condition | Routed To |
|-----------|-----------|
| `feels_in_danger=="yes"` | I4C_NCRP, LOCAL_POLICE, CWC |
| `location_type` is `"offline"` or `"both"` | I4C_NCRP, CWC |
| Default | I4C_NCRP |

---

## Test Command

```python
import httpx

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

r = httpx.post("http://localhost:8000/api/child-safety/reports", json=payload)
print(r.json())
```
