import hashlib
import hmac
import os

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from models import User


def hash_password(password):
    salt = os.urandom(16).hex()
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return salt + ":" + hashed


def check_password(password, stored):
    salt, hashed = stored.split(":")
    attempt = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return hmac.compare_digest(attempt, hashed)


def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Please log in")
    user = db.get(User, user_id)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Please log in")
    return user
