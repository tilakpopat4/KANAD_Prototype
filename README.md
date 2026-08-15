# KANAD Prototype — ForenSync
## Cyber Crime Case Timeline & Custody Integrity Tracker

A full-stack, local-first cyber forensics prototype built for the **KANAD S.H.I.E.L.D. Hackathon** (Cyber Crime Branch, Ahmedabad). ForenSync automates digital evidence parsing, reconstructs chronological event timelines, maintains an immutable chain-of-custody log, auto-routes complaints, and provides status tracking portals for both citizens and cyber crime investigators.

---

## ⚡ Two-Part Architecture

The codebase is **split into two logical parts** served by a **single FastAPI backend**:

| Part | Access | URL | Who uses it |
|------|--------|-----|-------------|
| **Part A — Citizen Portal** | 🌐 Public (internet-facing) | `/` | Any citizen |
| **Site Manager** | 🔑 Password-protected | `/sitemanager` | Admin only |
| **Part B — Police Intranet** | 🏢 Intranet (police premises) | `/employee`, `/admin` | Officers, investigators, admins |

> All API routes are shared by both parts through standard JWT authentication and role-based access control. No separate server needed.

```
                    ┌────────────────────────────────────────────┐
                    │         FastAPI Backend (port 8000)        │
                    │                                            │
          ┌─────────┤  /api/*   /complaints   /cases            ├─────────┐
          │         │  /analytics  /admin/employees  /token      │         │
          │         └────────────────────────────────────────────┘         │
          │                                                                 │
    INTERNET                                                         POLICE INTRANET
          │                                                                 │
   ┌──────▼──────────┐                                         ┌────────────▼──────────┐
   │  PART A         │                                         │  PART B               │
   │  Citizen Portal │                                         │  Police Intranet      │
   │                 │                                         │                       │
   │  /  → index.html│                                         │ /employee → employee  │
   │  /sitemanager   │                                         │ /admin    → admin.html│
   │  (admin login)  │                                         │                       │
   └─────────────────┘                                         └───────────────────────┘
```

---

## Key Features

1. **Standalone Evidence Parser Engine (`parser.py`)**:
   - Parses `.evtx` (Windows Event Log) binaries using `python-evtx` and maps namespaces dynamically.
   - Introspects `.sqlite` (app/browser database) structures read-only, matching timestamp fields, and normalizes rows.
   - Outputs a common event format schema: `{ timestamp_utc, event_type, description, source_file }`.
   - Built-in fallback mock parser triggers if files are offline/placeholder mocks, ensuring robust demo resilience.

2. **FastAPI Cyber Crime Backend (`main.py`)**:
   - Automated routing & priority scoring based on description keywords.
   - Real-time SHA-256 calculation upon digital evidence uploads.
   - Chronological timeline merging across multiple evidence files.
   - Real-time custody verification & tamper alerts: recalculates SHA-256 hashes on investigation load and compares them to upload values.

3. **Citizen Portal (`frontend/citizen/index.html`)**:
   - File new cyber incidents with real-time AI-routing category and priority predictions.
   - Look up complaint details, status, and desk assignments using a Ticket ID.
   - Upload multiple `.evtx` or `.sqlite` files to active complaints.
   - Announcement slideshow managed by the `/sitemanager` admin page.

4. **Site Manager (`frontend/citizen/sitemanager.html`)**:
   - Accessible at `/sitemanager` — protected by admin email + password login.
   - Create, manage, and delete announcement slides shown on the citizen portal.
   - Upload background images for slides.

5. **Employee Workstation (`frontend/police/employee.html`)**:
   - Case metrics overview and complete Incident Ledger (sortable/searchable).
   - Interactive, merged, chronological case timelines.
   - **Immutable Custody & Tamper Check Panel** tracking access audits and file hashes.
   - Dynamic crime analytical metrics (Doughnut and Line charts via Chart.js).
   - Collaborative case notes and FIR auto-drafting.

6. **Admin Control Portal (`frontend/police/admin.html`)**:
   - Employee directory management — create, activate/deactivate accounts.
   - Desk-wise case resolution metrics.

---

## Project Structure

```
/sample_data          - Scripts to generate/download mock files (.evtx, .sqlite)
/backend              - Python backend service
  - requirements.txt
  - parser.py         - Standalone .evtx and .sqlite parsing engine
  - database.py       - SQLAlchemy models and SQLite configuration
  - auth.py           - Password hashing and JWT generation (Roles: citizen, employee, investigator, admin)
  - main.py           - FastAPI endpoints + two-part static file serving
  - seed.py           - Seed script to populate mock cases, events, and audit logs
  - test_parser.py    - PyTest script to test parser.py on sample data
/frontend             - Frontend static files
  /citizen            - ── PART A: Public Citizen Portal ──
    - index.html      - Citizen landing page + complaint filing + tracking
    - sitemanager.html- Slideshow admin manager (password-protected)
    - citizen.js      - Citizen-only JavaScript (OTP auth, complaint, tracking, slideshow)
  /police             - ── PART B: Police Intranet ──
    - employee.html   - Employee/investigator workstation dashboard
    - admin.html      - Admin employee management portal
    - police.js       - Police-only JavaScript (case management, audit, FIR, analytics)
  /assets             - Shared assets (logo, images)
  - style.css         - Shared CSS design system (dark mode, glassmorphism)
README.md             - Setup and running guide
```

---

## Quick Start Guide (Local Setup)

### 1. Prerequisites
- Python 3.9 to 3.11 installed.

### 2. Setup Virtual Environment & Install Dependencies
Run the following in the project root:
```powershell
# Create virtual environment
python -m venv backend/.venv

# Activate and install dependencies (Windows PowerShell)
.\backend\.venv\Scripts\pip install -r backend/requirements.txt
```

### 3. Generate Mock Evidence Files & Seed the Database
Run the helper scripts to set up the directories, mock database logs, and populate default credentials:
```powershell
# Generate sample files (mock_browser.sqlite and security_sample.evtx)
.\backend\.venv\Scripts\python sample_data/generate_samples.py

# Seed the sqlite database
.\backend\.venv\Scripts\python backend/seed.py
```

### 4. Run Standalone Parser Unit Tests
Ensure the parser is correctly handling `.sqlite` and `.evtx` files:
```powershell
.\backend\.venv\Scripts\pytest backend/test_parser.py
```

### 5. Launch the Server
Start the FastAPI server:
```powershell
.\backend\.venv\Scripts\python backend/main.py
```
Open your browser and navigate to **`http://localhost:8000`** to interact with the citizen portal.

**Police intranet portals** (access from police network only):
- Employee: `http://localhost:8000/employee`
- Admin: `http://localhost:8000/admin`
- Site Manager: `http://localhost:8000/sitemanager`

---

## Hackathon Demo Account Credentials

| Role | Email | Password | Portal |
|------|-------|----------|--------|
| 🕵️ Investigator | `investigator@forensync.gov` | `investigator123` | `/employee` |
| 🛡️ Admin | `admin@forensync.gov` | `admin123` | `/admin`, `/sitemanager` |
| 👤 Citizen | `citizen@forensync.gov` | `citizen123` | `/` (via OTP) |

**Demo ticket IDs for tracking**: `TXN-90210`, `TXN-48392`, `TXN-11234`
