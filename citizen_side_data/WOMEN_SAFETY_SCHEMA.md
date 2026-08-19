# Women Safety Cyber Crime Schema (WSR)

Reference ID Format: `WSR-YYYY-XXXX` (e.g., `WSR-2026-3091`)

## Mandatory & Optional Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `incident_type` | string | Yes | `cyberstalking`, `harassment`, `morphing`, `blackmail`, `defamation`, `voyeurism` |
| `anonymous` | boolean | Yes | Whether the reporter chose to file anonymously |
| `reporter_name` | string | Optional | Full name (or "Anonymous") |
| `reporter_email` | string | Optional | Email for OTP and status updates |
| `reporter_phone` | string | Optional | Contact phone number |
| `description` | string | Yes | Detailed account of the incident |
| `platform` | string | Yes | `Instagram`, `WhatsApp`, `Facebook`, `Telegram`, `Snapchat`, `X`, `Dating App`, `Other` |
| `suspect_profile` | string | Optional | Suspect's handle, URL, phone number, or account ID |
| `threat_level` | string | Yes | `critical` (5), `high` (4), `medium` (3) |
| `evidence_urls` | array | Optional | Array of uploaded screenshot/media hashes |
| `location` | object | Optional | State, District, City |

## Sample Payload

```json
{
  "incident_type": "cyberstalking",
  "anonymous": true,
  "reporter_name": "Anonymous",
  "reporter_email": "victim_safety@example.com",
  "platform": "Instagram",
  "suspect_profile": "@stalker_unknown_99",
  "description": "Persistent cyberstalking, abusive direct messages, and threats to distribute morphed photographs across social media platforms.",
  "threat_level": "critical",
  "priority_score": 5
}
```
