from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User
from app.services import audit

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def current_user(db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired credentials",
                                 headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        payload = decode_token(creds.credentials, "access")
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise unauthorized from None
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def require(*codes: str):
    """Dependency factory: the user must hold every listed permission."""

    def checker(user: CurrentUser) -> User:
        missing = [c for c in codes if c not in user.permission_codes]
        if missing:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {', '.join(missing)}")
        return user

    return checker


def perm(*codes: str):
    """Annotated type that resolves to the current user after checking permissions."""
    return Annotated[User, Depends(require(*codes))]


class Auditor:
    """Request-bound helper that writes audit rows in the caller's transaction."""

    def __init__(self, request: Request, db: DB, user: CurrentUser):
        self.db, self.user = db, user
        self.ip = request.client.host if request.client else None

    def log(self, action: str, entity_type: str, entity_id=None, before=None, after=None) -> None:
        audit.record(self.db, user_id=self.user.id, action=action, entity_type=entity_type,
                     entity_id=entity_id, before=before, after=after, ip=self.ip)


Audit = Annotated[Auditor, Depends(Auditor)]
