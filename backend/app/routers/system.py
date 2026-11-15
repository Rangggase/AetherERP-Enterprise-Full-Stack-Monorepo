from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from app.core.deps import DB, Audit, require
from app.core.errors import Conflict, DomainError, NotFound
from app.core.security import hash_password, password_problem
from app.models import AuditLog, Branch, RefreshToken, Role, User
from app.services import dashboard

router = APIRouter(tags=["dashboard & system"])


@router.get("/dashboard/overview", dependencies=[Depends(require("dashboard.read"))])
def overview(db: DB, branch_id: int | None = None, as_of: date | None = None):
    return dashboard.overview(db, branch_id=branch_id, as_of=as_of)


@router.get("/audit-logs", dependencies=[Depends(require("audit.read"))])
def audit_logs(db: DB, entity_type: str | None = None, user_id: int | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)):
    stmt = select(AuditLog, User.full_name).outerjoin(User, User.id == AuditLog.user_id)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"total": total, "page": page, "page_size": page_size, "items": [
        {"id": a.id, "user": n, "user_id": a.user_id, "action": a.action, "entity_type": a.entity_type,
         "entity_id": a.entity_id, "before": a.before, "after": a.after, "ip_address": a.ip_address,
         "created_at": a.created_at} for a, n in rows]}


def _user(u: User) -> dict:
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.name, "role_id": u.role_id,
            "branch_id": u.branch_id, "is_active": u.is_active}


def _active_admins(db) -> int:
    return db.execute(
        select(func.count()).select_from(User).join(Role, Role.id == User.role_id).where(Role.name == "Admin", User.is_active)
    ).scalar_one()


def _revoke_sessions(db, user_id: int) -> None:
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id).values(revoked=True))


class UserIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+$", max_length=160)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(max_length=200)
    role_id: int
    branch_id: int | None = None


class UserPatch(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=120)
    role_id: int | None = None
    branch_id: int | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(max_length=200)


@router.get("/system/users", dependencies=[Depends(require("users.manage"))])
def users(db: DB):
    return [_user(u) for u in db.execute(select(User).order_by(User.id)).scalars()]


@router.post("/system/users", status_code=201)
def create_user(body: UserIn, db: DB, audit: Audit, _: Annotated[User, Depends(require("users.manage"))]):
    if (problem := password_problem(body.password)):
        raise DomainError(problem)
    email = body.email.strip().lower()
    if db.execute(select(User.id).where(User.email == email)).first():
        raise Conflict("A user with this email already exists")
    if db.get(Role, body.role_id) is None:
        raise NotFound("Role not found")
    if body.branch_id is not None and db.get(Branch, body.branch_id) is None:
        raise NotFound("Branch not found")
    u = User(email=email, full_name=body.full_name.strip(), password_hash=hash_password(body.password),
             role_id=body.role_id, branch_id=body.branch_id)
    db.add(u)
    db.flush()
    db.refresh(u)
    audit.log("CREATE", "user", u.id, after={"email": u.email, "role": u.role.name})
    db.commit()
    return _user(u)


@router.patch("/system/users/{user_id}")
def update_user(user_id: int, body: UserPatch, db: DB, audit: Audit, me: Annotated[User, Depends(require("users.manage"))]):
    u = db.get(User, user_id)
    if u is None:
        raise NotFound("User not found")
    before = _user(u)
    changes = body.model_dump(exclude_unset=True)
    if "role_id" in changes and db.get(Role, changes["role_id"]) is None:
        raise NotFound("Role not found")
    if changes.get("branch_id") is not None and db.get(Branch, changes["branch_id"]) is None:
        raise NotFound("Branch not found")
    admin_role = db.execute(select(Role.id).where(Role.name == "Admin")).scalar_one()
    loses_admin = u.is_active and u.role_id == admin_role and (changes.get("is_active") is False or changes.get("role_id", admin_role) != admin_role)
    if loses_admin and (u.id == me.id or _active_admins(db) <= 1):
        raise Conflict("At least one other active administrator must remain, and you cannot demote or deactivate yourself")
    if u.id == me.id and changes.get("is_active") is False:
        raise Conflict("You cannot deactivate your own account")
    for k, v in changes.items():
        setattr(u, k, v)
    db.flush()
    db.refresh(u)
    if changes.get("is_active") is False or "role_id" in changes:
        _revoke_sessions(db, u.id)  # force a fresh sign-in so permissions take effect
    audit.log("UPDATE", "user", u.id, before=before, after=_user(u))
    db.commit()
    return _user(u)


@router.post("/system/users/{user_id}/reset-password", status_code=204)
def reset_password(user_id: int, body: PasswordReset, db: DB, audit: Audit, _: Annotated[User, Depends(require("users.manage"))]):
    u = db.get(User, user_id)
    if u is None:
        raise NotFound("User not found")
    if (problem := password_problem(body.new_password)):
        raise DomainError(problem)
    u.password_hash = hash_password(body.new_password)
    _revoke_sessions(db, u.id)
    audit.log("PASSWORD_RESET", "user", u.id)
    db.commit()


@router.get("/system/roles", dependencies=[Depends(require("users.manage"))])
def roles(db: DB):
    return [{"id": r.id, "name": r.name, "permissions": sorted(p.code for p in r.permissions)}
            for r in db.execute(select(Role).order_by(Role.id)).scalars()]
