import uuid
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _hasher.verify(password, hashed)


def password_problem(password: str) -> str | None:
    """Return why a password is unacceptable, or None when it meets the policy."""
    if len(password) < 10:
        return "Password must be at least 10 characters"
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Password must contain at least one letter and one digit"
    if password.lower() in {"password123", "1234567890", "aether#demo2026"}:
        return "Password is too common"
    return None


def _encode(sub: int, kind: str, ttl: timedelta, extra: dict | None = None) -> tuple[str, dict]:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(sub), "type": kind, "iat": now, "exp": now + ttl, "jti": uuid.uuid4().hex, **(extra or {})}
    return jwt.encode(payload, get_settings().secret_key, algorithm="HS256"), payload


def create_access_token(user_id: int) -> str:
    return _encode(user_id, "access", timedelta(minutes=get_settings().access_token_minutes))[0]


def create_refresh_token(user_id: int, family: str | None = None) -> tuple[str, dict]:
    return _encode(
        user_id,
        "refresh",
        timedelta(days=get_settings().refresh_token_days),
        {"family": family or uuid.uuid4().hex},
    )


def decode_token(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
