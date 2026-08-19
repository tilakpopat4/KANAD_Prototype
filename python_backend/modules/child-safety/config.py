"""
config.py — India-localized crisis resources, helplines, categories, and routing rules.
All numbers below are Indian-government / India-recognized services.
Kept in one place so the frontend fetches them from /api/child-safety/resources
and we never hardcode helpline numbers across the UI.
"""

# --- Persistent safety strip (section 2.2) ---
IMMEDIATE_DANGER = {
    "primary": {"label": "India Unified Emergency", "number": "112"},
    "legacy_police": {"label": "Police (legacy)", "number": "100"},
    "message": "If you or someone you know is in immediate danger, please call 112 "
               "or your nearest police station immediately.",
}

# --- Speak to someone directly (section 2.3) ---
DIRECT_SUPPORT = {
    "childline": {"label": "CHILDLINE (Ministry of Women & Child Development)",
                  "number": "1098",
                  "note": "National 24x7 emergency helpline for children in distress. All languages."},
    "pocso_ebox": {"label": "POCSO e-Box (NCPCR)", "url": "https://pocsoebox.gov.in",
                   "note": "Lets a child directly submit a complaint without an adult intermediary."},
}

# --- Other-incident routing (pre-form modal, section 2.4) ---
OTHER_RESOURCES = {
    "domestic_violence": {
        "ncw": {"label": "National Commission for Women", "number": "7827170170"},
        "women_helpline": {"label": "Women Helpline (24x7)", "number": "181"},
    },
    "child_welfare": {
        "childline": {"label": "CHILDLINE", "number": "1098"},
        "pocso_ebox": {"label": "POCSO e-Box", "url": "https://pocsoebox.gov.in"},
    },
}

# --- Takedown-assistance sidebar (section 2.8) ---
TAKEDOWN_HELP = {
    "stopncii": {"label": "StopNCII.org", "url": "https://stopncii.org",
                 "note": "Free tool for adults. Generates a secure hash on your own device; "
                         "the image never leaves your device."},
    "take_it_down": {"label": "Take It Down (NCMEC)", "url": "https://takeitdown.ncmec.org",
                     "note": "For anyone who was under 18 when the image/video was taken."},
    "it_rules_2021": "Under India's IT Rules 2021, platforms must have a Grievance Officer "
                     "and act on takedown requests within a defined timeframe. File a "
                     "platform-level report in parallel.",
}

# --- Report to law enforcement (section 2.9) ---
LAW_ENFORCEMENT = {
    "ncrp": {"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in",
             "category": "Report Crime related to Women/Child (covers CSEAM, anonymous path available)."},
    "cyber_helpline": {"label": "Cyber Crime Helpline", "number": "1930"},
}

# --- Incident categories (section 2.6) — plain-language, mapped internally to Indian law ---
# The citizen never has to know section numbers; we store the legal mapping server-side.
INCIDENT_CATEGORIES = [
    {"key": "csam_possession", "label": "Sharing or possession of sexual images/videos of a child (CSEAM)",
     "legal": ["IT Act 67B", "POCSO Act", "BNS"]},
    {"key": "grooming_sextortion", "label": "Online grooming / sextortion of a child",
     "legal": ["POCSO Act", "IT Act 67B", "BNS"]},
    {"key": "live_streamed_abuse", "label": "Live-streamed abuse", "legal": ["POCSO Act", "IT Act 67B"]},
    {"key": "child_trafficking", "label": "Child sex trafficking", "legal": ["BNS", "POCSO Act"]},
    {"key": "online_solicitation", "label": "A child was solicited online for sexual purposes",
     "legal": ["POCSO Act", "IT Act 67B"]},
    {"key": "pressuring_for_images", "label": "An adult is pressuring a child for sexual images",
     "legal": ["POCSO Act", "IT Act 67B"]},
    {"key": "other_enticement", "label": "Other online enticement or exploitation of a child",
     "legal": ["POCSO Act"]},
    {"key": "something_else", "label": "Something else concerning a child's safety online",
     "legal": []},
]

# --- Routing destinations (section 2.5) ---
ROUTING = {
    "default": ["I4C_NCRP"],                       # Indian Cyber Crime Coordination Centre
    "danger": ["I4C_NCRP", "LOCAL_POLICE", "CWC"], # + local police + Child Welfare Committee
    "offline_involved": ["I4C_NCRP", "CWC"],
}