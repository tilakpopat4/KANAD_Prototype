import datetime
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import hashlib
import os
from sqlalchemy.orm import Session
import database

# Secret key to sign JWT
SECRET_KEY = "FORENSYNC_SUPER_SECRET_KEY_FOR_HACKATHON_2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def verify_password(plain_password, hashed_password):
    try:
        salt_hex, key_hex = hashed_password.split(':')
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, 100000)
        return new_key == key
    except Exception:
        return False

def get_password_hash(password):
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)) -> database.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    # ── Check if it is a Firebase token ──
    try:
        unverified = jwt.get_unverified_claims(token)
        iss = unverified.get("iss", "")
        if "securetoken.google.com" in iss:
            import firebase_admin
            from firebase_admin import auth as fb_auth, firestore
            
            decoded = fb_auth.verify_id_token(token)
            email = decoded.get("email")
            if not email:
                raise credentials_exception
                
            user = db.query(database.User).filter(database.User.email == email).first()
            if not user:
                role = "employee"
                name = decoded.get("name", email.split("@")[0])
                desk = "General Desk"
                branch_id = None
                
                try:
                    fs_db = firestore.client()
                    doc = fs_db.collection("users").document(decoded.get("uid")).get()
                    if doc.exists:
                        fs_data = doc.to_dict()
                        role = fs_data.get("role", "employee")
                        name = fs_data.get("name", name)
                        desk = fs_data.get("desk", desk)
                        branch_id = fs_data.get("branchId", None)
                except Exception:
                    pass
                
                user = database.User(
                    name=name,
                    email=email,
                    role=role,
                    password_hash="firebase_managed",
                    desk=desk,
                    branch_id=branch_id,
                    is_active=1
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                try:
                    fs_db = firestore.client()
                    doc = fs_db.collection("users").document(decoded.get("uid")).get()
                    if doc.exists:
                        fs_data = doc.to_dict()
                        user.role = fs_data.get("role", user.role)
                        user.desk = fs_data.get("desk", user.desk)
                        user.branch_id = fs_data.get("branchId", user.branch_id)
                        user.is_active = 0 if fs_data.get("status") == "suspended" else 1
                        db.commit()
                except Exception:
                    pass
            
            if user.is_active == 0:
                raise HTTPException(status_code=403, detail="User account is deactivated")
                
            return user
    except Exception as e:
        pass

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(database.User).filter(database.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_employee(current_user: database.User = Depends(get_current_user)) -> database.User:
    if current_user.role not in ["employee", "investigator", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to employee/investigators"
        )
    return current_user

def get_current_investigator(current_user: database.User = Depends(get_current_user)) -> database.User:
    return get_current_employee(current_user)

def get_current_admin(current_user: database.User = Depends(get_current_user)) -> database.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to admin"
        )
    return current_user
