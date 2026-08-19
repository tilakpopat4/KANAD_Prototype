"""Government compliance constants (MeitY / CERT-In / DPDP)."""

# MeitY password policy
PASSWORD_MAX_AGE_DAYS = 90            # 30 for sensitive systems
PASSWORD_HISTORY_COUNT = 5           # cannot reuse last 5
MAX_LOGIN_RETRIES = 3                # 2 for sensitive systems
LOCKOUT_MINUTES = 15

# MeitY / e-Pramaan session policy
IDLE_TIMEOUT_MINUTES = 15            # uniform idle timeout
ACCESS_TOKEN_EXPIRE_MINUTES = 15
ABSOLUTE_SESSION_HOURS = 8           # hard cap regardless of activity

# CERT-In / MeitY audit retention
AUDIT_RETENTION_DAYS = 730           # 2 years for privileged actions
INCIDENT_REPORT_WINDOW_HOURS = 6     # CERT-In reporting window

# DPDP Act 2023
DPDP_PURPOSE = "Registration and tracking of cybercrime complaints with the Cyber Crime Branch."
DPDP_RETENTION_NOTE = "Personal data retained only as long as required for complaint resolution and legal compliance."