"""dependencies.py — reusable auth/authorization guards for protected routes."""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..database import database
from . import security
from .models import RevokedToken

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(database.get_db),
) -> database.User:
    unauth = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated",
                           headers={"WWW-Authenticate": "Bearer"})
    if not creds:
        raise unauth
    payload = security.decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise unauth
    # Check denylist (revoked access tokens)
    if db.query(RevokedToken).filter(RevokedToken.jti == payload.get("jti")).first():
        raise unauth
    user = db.query(database.User).filter(database.User.email == payload.get("sub")).first()
    if not user or not user.is_active:
        raise unauth
    return user


def require_role(*allowed_roles: str):
    """Role-based access control factory (OWASP: least privilege, deny by default)."""
    def guard(user: database.User = Depends(get_current_user)) -> database.User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return guard

# Usage examples:
# @router.get("/profile", dependencies=[Depends(get_current_user)])
# @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])