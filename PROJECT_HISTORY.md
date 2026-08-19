# ForenSync - Project History & Context

## Project Overview
**ForenSync** (National Cyber Crime Reporting Portal) is a full-stack web application designed for a cyber crime branch to efficiently handle public complaint registration, evidence collection, and internal case investigation. 

The application streamlines the incident reporting process and equips law enforcement officers with an automated dashboard for case tracking, digital evidence hashing, and FIR generation.

## Technical Architecture
The project follows a two-part frontend architecture powered by a unified backend:

### 1. Frontend (Vanilla HTML, CSS, JavaScript)
The frontend is cleanly separated into two security zones:
*   **Citizen Portal (`frontend/citizen/`) - Public Facing**
    *   `index.html`: The interactive public landing page where citizens can authenticate, file cyber complaints, and track case statuses.
    *   `sitemanager.html`: A password-protected view for managing the citizen portal's dynamic sliding banners.
*   **Police Intranet (`frontend/police/`) - Restricted**
    *   `employee.html`: The investigator dashboard for officers to review cases, view evidence timelines, and manage case notes.
    *   `admin.html`: The administrative portal for managing police personnel accounts and viewing system analytics.

### 2. Backend (Python FastAPI & SQLAlchemy)
*   **Framework**: FastAPI handles all API routing, file uploads, and statically serves the separated frontend directories.
*   **Database**: SQLite (`forensync.db`) with SQLAlchemy ORM.
*   **Key Features**:
    *   **Auto-Routing Engine**: Automatically categorizes incidents and assigns priority scores (1-5) based on keywords in the complaint description.
    *   **Evidence Handling**: Uploads are automatically hashed (SHA-256) and simulated for malware scanning.
    *   **Timeline Parsing**: Custom parsing logic (`evidence_parser.py`) to extract timeline events from digital evidence logs (like `.evtx` or `.sqlite`).

## Deployment Strategy (Vercel)
The application is configured to deploy seamlessly on Vercel as a serverless application:
*   `vercel.json`: Directs all incoming traffic (`/*`) to the FastAPI backend (`backend/main.py`), which acts as the Vercel serverless function.
*   **Ephemeral Storage Handling**: Because Vercel serverless functions have a strict read-only filesystem, the backend is programmed to dynamically create the SQLite database and upload directories inside the writable `/tmp` folder whenever `VERCEL` environment variables are detected.
*   **Auto-Seeding**: Upon a fresh serverless start, the backend automatically initializes the database tables and runs a seed script (`seed.py`) to generate default admin, investigator, and citizen accounts, along with mock cases and evidence.

---

## Recent Development History (August 2026)
Here is a summary of the recent architectural changes and fixes applied to the prototype:

1.  **Frontend Restructuring**: 
    *   Successfully divided the monolithic frontend into the `citizen/` (public) and `police/` (intranet) subdirectories. 
    *   Cleaned up redundant HTML/JS files from the root `frontend` folder to finalize the two-part architecture.
2.  **Vercel Configuration**: 
    *   Generated `vercel.json` and a root `requirements.txt` to instruct Vercel's `@vercel/python` builder on how to build and route the FastAPI application.
3.  **Read-Only Filesystem Fixes**: 
    *   Diagnosed and resolved a `500 INTERNAL_SERVER_ERROR` on Vercel caused by the backend attempting to create `uploads/` and `forensync.db` in a read-only directory. 
    *   Implemented logic to utilize `/tmp` for all file writes in production.
    *   Integrated unconditional database initialization and data seeding for the ephemeral Vercel environment.
4.  **Standard Library Conflict Resolution**: 
    *   Diagnosed a secondary `FUNCTION_INVOCATION_FAILED` crash on Vercel. 
    *   Discovered a naming collision with the built-in Python `parser` module and our custom `backend/parser.py`. 
    *   Renamed the module to `evidence_parser.py` and updated `sys.path` injections to guarantee safe module loading in Vercel.
5.  **Version Control**: 
    *   Initialized Git, committed all structural and deployment fixes, and pushed the stable codebase to the remote repository (`https://github.com/tilakpopat4/KANAD_Prototype.git`).
