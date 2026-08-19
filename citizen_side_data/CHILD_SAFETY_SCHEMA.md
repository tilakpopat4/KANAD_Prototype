# Child Safety & Protection Cyber Crime Schema (CSR)

Reference ID Format: `CSR-YYYY-XXXX` (e.g., `CSR-2026-5544`)

## Mandatory & Optional Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `screening` | object | Yes | `{ is_minor: true, victim_age: number, relationship: string }` |
| `category_key` | string | Yes | `online_grooming`, `csam_reporting`, `cyberbullying`, `gaming_extortion`, `identity_theft` |
| `reporter_name` | string | Yes | Parent/Guardian or Reporter Name (or "Anonymous") |
| `reporter_email` | string | Optional | Email for tracking and communication |
| `reporter_phone` | string | Optional | Contact phone number |
| `victim_age` | number | Yes | Age of victim (under 18) |
| `platform` | string | Yes | `Discord`, `Roblox`, `Instagram`, `Snapchat`, `WhatsApp`, `Telegram`, `Other` |
| `suspect` | object | Optional | `{ handle: string, profile_url: string, ip_or_phone: string }` |
| `description` | string | Yes | Detailed account of the incident |
| `priority_score` | number | Yes | Auto-assigned 5 (Critical) for POCSO/Child Protection |

## Sample Payload

```json
{
  "screening": {
    "is_minor": true,
    "victim_age": 14,
    "relationship": "Parent"
  },
  "category_key": "online_grooming",
  "reporter_name": "Pooja Sharma (Parent)",
  "reporter_email": "pooja.sharma@example.com",
  "platform": "Discord",
  "suspect": {
    "handle": "shadow_gamer#4412"
  },
  "description": "Suspect contacted minor victim through online Discord server, requesting explicit photographs and attempting blackmail.",
  "priority_score": 5
}
```
