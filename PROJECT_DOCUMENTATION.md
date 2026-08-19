# ForenSync - Project Documentation

## Overview
ForenSync is a comprehensive Cyber Crime Reporting and Management System designed for Ahmedabad Cyber Crime Unit. It provides modules for fraud complaints, child safety reporting, and governance tracking.

---

## 📁 Project Structure

```
kanad_shield/
├── api/                          # Backend API Layer
│   ├── main.py                   # Main FastAPI application entry point
│   ├── integrated_main.py        # Integrated main with all modules
│   ├── requirements.txt          # Python dependencies
│   ├── core/                     # Core shared components
│   │   ├── models.py             # Base database models
│   │   ├── schemas.py            # Pydantic schemas for validation
│   │   ├── routes.py             # Core API routes
│   │   ├── security.py           # Authentication & security utilities
│   │   └── dependencies.py       # FastAPI dependencies
│   ├── database/                 # Database configuration
│   │   └── database.py           # Database connection & session management
│   └── modules/                  # Feature modules
│       ├── fraud-complaint/      # Financial Fraud Reporting Module
│       │   ├── config.py         # Module configuration
│       │   ├── main.py           # Module entry point
│       │   ├── models.py         # Fraud complaint database models
│       │   ├── routes.py         # Fraud complaint API routes
│       │   └── schemas.py        # Fraud complaint schemas
│       ├── child-safety/         # Child Safety Reporting Module
│       │   ├── config.py         # Module configuration
│       │   ├── main.py           # Module entry point
│       │   ├── models.py         # Child safety database models
│       │   ├── routes.py         # Child safety API routes
│       │   └── schemas.py        # Child safety schemas
│       └── governance/           # Governance & Compliance Module
│           ├── gov_config.py     # Governance configuration
│           ├── gov_model.py      # Governance models
│           ├── gov_models.py     # Additional governance models
│           └── gov_rules.py      # Governance rules & logic
│
├── frontend/                     # Frontend Application
│   ├── assets/                   # Static assets (images, logos)
│   │   └── logo.png              # Application logo
│   ├── public/                   # Public HTML pages
│   │   └── contact.html          # Contact page
│   └── src/                      # Source code
│       ├── citizen/              # Citizen Portal
│       │   ├── index.html        # Citizen dashboard
│       │   ├── citizen.js        # Citizen portal JavaScript
│       │   ├── fraud-complaint.html    # Fraud complaint form
│       │   ├── fraud-complaint.js      # Fraud complaint JavaScript
│       │   └── sitemanager.html        # Site management page
│       ├── police/               # Police/Admin Portal
│       │   ├── admin.html        # Admin dashboard
│       │   ├── employee.html     # Employee management
│       │   ├── dashboard.html    # Police dashboard
│       │   └── police.js         # Police portal JavaScript
│       └── shared/               # Shared resources
│           └── style.css         # Global styles
│
├── docs/                         # Documentation
│   └── fir_citizen_intake_schema.json  # FIR schema reference
│
├── tests/                        # Test files (empty - for future use)
│
├── forensync.db                  # SQLite database (root level)
├── requirements.txt              # Root requirements file
└── PROJECT_DOCUMENTATION.md      # This file
```

---

## 🔧 Changes Made

### 1. Folder Restructuring

#### Before (Chaotic Structure):
```
kanad_shield/
├── fruad_complaint/          # Typo in folder name
├── child-safety/             # Inconsistent naming
├── backend/                  # Mixed with other files
├── gov_*.py                  # Scattered governance files
├── models.py, schemas.py     # Core files in root
└── frontend/                 # Had mixed citizen/police files
```

#### After (Organized Structure):
```
kanad_shield/
├── api/                      # All backend code organized
│   ├── core/                 # Shared components
│   ├── database/             # Database layer
│   └── modules/              # Feature modules
├── frontend/                 # Frontend organized
│   ├── src/                  # Source code
│   │   ├── citizen/          # Citizen portal
│   │   ├── police/           # Police portal
│   │   └── shared/           # Shared resources
│   ├── public/               # Public pages
│   └── assets/               # Static assets
└── docs/                     # Documentation
```

### 2. File Movements

| Old Location | New Location | Reason |
|--------------|--------------|--------|
| `fruad_complaint/*` | `api/modules/fraud-complaint/*` | Fixed typo, organized under modules |
| `child-safety/*` | `api/modules/child-safety/*` | Consistent naming, modular structure |
| `gov_*.py` | `api/modules/governance/*` | Grouped governance files |
| `models.py, schemas.py, security.py, dependencies.py` | `api/core/*` | Core shared components |
| `database.py` | `api/database/database.py` | Database layer separation |
| `routes.py` | `api/core/routes.py` | Core routes |
| `backend/main.py, integrated_main.py` | `api/main.py, api/integrated_main.py` | Simplified structure |
| `frontend/citizen/*` | `frontend/src/citizen/*` | Organized source code |
| `frontend/police/*` | `frontend/src/police/*` | Organized source code |
| `frontend/style.css` | `frontend/src/shared/style.css` | Shared resources |
| `frontend/contact.html` | `frontend/public/contact.html` | Public pages |
| `dashboard.html` | `frontend/src/police/dashboard.html` | Police portal |
| `fir_citizen_intake_schema.json` | `docs/fir_citizen_intake_schema.json` | Documentation |

### 3. Code Changes

#### Fraud Complaint Form (`frontend/src/citizen/fraud-complaint.html`)

**Step Badge Navigation Enhancement:**
```css
/* Added to make step badges clickable */
.step-badge {
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
}

.step-badge:hover {
    background: rgba(24,84,142,0.15);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(24,84,142,0.15);
}

.step-badge.active {
    cursor: default;
}

.step-badge.completed:hover {
    background: rgba(16,185,129,0.25);
}
```

**Why:** Users can now click on step badges to navigate between form steps, making the form more user-friendly.

**Country Dropdown Enhancement:**
```html
<select id="country" class="form-control" required onchange="toggleStateField()">
    <option value="">Select country</option>
    <option value="India">India</option>
    <option value="United States">United States</option>
    <option value="United Kingdom">United Kingdom</option>
    <option value="Canada">Canada</option>
    <option value="Australia">Australia</option>
    <option value="Other">Other</option>
</select>
```

**Why:** Added default country options so the dropdown isn't empty before JavaScript loads, improving user experience.

---

## 🚀 How to Run the Project

### Backend (API)

1. **Navigate to API directory:**
   ```bash
   cd api
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the main application:**
   ```bash
   uvicorn main:app --reload
   ```

   Or run the integrated version:
   ```bash
   uvicorn integrated_main:app --reload
   ```

4. **Access API documentation:**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

### Frontend

1. **Serve frontend files:**
   - Use any static file server (e.g., Live Server in VS Code)
   - Or open HTML files directly in browser

2. **Access portals:**
   - Citizen Portal: `frontend/src/citizen/index.html`
   - Police Portal: `frontend/src/police/dashboard.html`

---

## 📦 Module Descriptions

### 1. Fraud Complaint Module (`api/modules/fraud-complaint/`)
- **Purpose:** Handle financial fraud complaints (UPI, bank transfers, credit card fraud)
- **Key Features:**
  - Multi-step complaint form
  - Transaction details tracking
  - Subject information collection
  - Incident description with character limits
  - Reference ID generation for tracking

### 2. Child Safety Module (`api/modules/child-safety/`)
- **Purpose:** Handle child safety-related cyber crime reports
- **Key Features:**
  - Child protection reporting
  - Age-appropriate form fields
  - Guardian information collection

### 3. Governance Module (`api/modules/governance/`)
- **Purpose:** Compliance and governance tracking
- **Key Features:**
  - Rule management
  - Configuration management
  - Audit trails

---

## 🔗 Integration Points

### For Other Projects

1. **API Integration:**
   - Base URL: `http://localhost:8000`
   - All modules expose REST endpoints
   - Swagger documentation available at `/docs`

2. **Database Integration:**
   - SQLite database: `forensync.db`
   - SQLAlchemy models in `api/core/models.py`
   - Database utilities in `api/database/database.py`

3. **Frontend Integration:**
   - Static files in `frontend/src/`
   - Shared styles in `frontend/src/shared/style.css`
   - Modular JavaScript files

---

## 📝 API Endpoints Structure

```
/api/v1/
├── /fraud-complaint/         # Fraud complaint endpoints
├── /child-safety/            # Child safety endpoints
├── /governance/              # Governance endpoints
└── /auth/                    # Authentication endpoints (in core/routes.py)
```

---

## 🛡️ Security Features

- **Authentication:** JWT token-based (in `api/core/security.py`)
- **Password Hashing:** bcrypt
- **Input Validation:** Pydantic schemas
- **CORS:** Configured for frontend access

---

## 🧪 Testing

Test files should be placed in the `tests/` directory. Run tests with:
```bash
pytest tests/
```

---

## 📚 Additional Resources

- **FIR Schema:** `docs/fir_citizen_intake_schema.json`
- **Requirements:** `api/requirements.txt`
- **Database:** `forensync.db` (SQLite)

---

## 🤝 Contributing

When adding new features:
1. Create new modules under `api/modules/`
2. Add frontend pages under `frontend/src/`
3. Update this documentation
4. Add tests in `tests/`

---

## 📞 Support

- **Emergency Helpline:** 1930 (Cyber Crime)
- **Police:** 100
- **Emergency Services:** 112

---

## 📄 License

All rights reserved © ForenSync - Cyber Shield Ahmedabad

---

**Last Updated:** August 18, 2026
**Version:** 1.0.0
**Author:** Development Team
