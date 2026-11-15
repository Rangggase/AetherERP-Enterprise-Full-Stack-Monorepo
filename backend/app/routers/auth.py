from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from app.core.deps import DB, CurrentUser
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, password_problem, verify_password,
)
from app.models import RefreshToken, User
from app.schemas.common import ORM
from app.services import audit

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    # Plain string on purpose: internal domains such as *.local must be able to sign in.
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeOut(ORM):
    id: int
    email: str
    full_name: str
    branch_id: int | None
    role: str
    permissions: list[str]


def _issue(db, user_id: int, family: str | None = None) -> TokenOut:
    refresh, payload = create_refresh_token(user_id, family)
    db.add(RefreshToken(jti=payload["jti"], family=payload["family"], user_id=user_id,
                        expires_at=datetime.fromtimestamp(payload["exp"].timestamp(), timezone.utc).replace(tzinfo=None)))
    return TokenOut(access_token=create_access_token(user_id), refresh_token=refresh)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DB):
    user = db.execute(select(User).where(User.email == body.email.lower())).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        audit.record(db, user_id=user.id if user else None, action="LOGIN_FAILED", entity_type="user", entity_id=body.email)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    tokens = _issue(db, user.id)
    audit.record(db, user_id=user.id, action="LOGIN", entity_type="user", entity_id=user.id)
    db.commit()
    return tokens


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: DB):
    bad = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    try:
        payload = decode_token(body.refresh_token, "refresh")
    except jwt.PyJWTError:
        raise bad from None
    record = db.execute(select(RefreshToken).where(RefreshToken.jti == payload["jti"])).scalar_one_or_none()
    if record is None:
        raise bad
    if record.revoked:
        # A rotated token was replayed: assume theft and revoke the whole family.
        db.execute(update(RefreshToken).where(RefreshToken.family == record.family).values(revoked=True))
        db.commit()
        raise bad
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise bad
    record.revoked = True
    tokens = _issue(db, user.id, record.family)
    db.commit()
    return tokens


@router.post("/logout", status_code=204)
def logout(body: RefreshIn, db: DB):
    try:
        payload = decode_token(body.refresh_token, "refresh")
    except jwt.PyJWTError:
        return
    db.execute(update(RefreshToken).where(RefreshToken.family == payload["family"]).values(revoked=True))
    db.commit()


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


@router.post("/change-password", status_code=204)
def change_password(body: ChangePasswordIn, db: DB, user: CurrentUser):
    if not verify_password(body.current_password, user.password_hash):
        audit.record(db, user_id=user.id, action="PASSWORD_CHANGE_FAILED", entity_type="user", entity_id=user.id)
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(422, "The new password must differ from the current one")
    if (problem := password_problem(body.new_password)):
        raise HTTPException(422, problem)
    user.password_hash = hash_password(body.new_password)
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True))
    audit.record(db, user_id=user.id, action="PASSWORD_CHANGED", entity_type="user", entity_id=user.id)
    db.commit()


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser):
    return MeOut(id=user.id, email=user.email, full_name=user.full_name, branch_id=user.branch_id,
                 role=user.role.name, permissions=sorted(user.permission_codes))
