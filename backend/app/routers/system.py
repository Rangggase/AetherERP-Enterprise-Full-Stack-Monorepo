from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.core.deps import DB, require
from app.models import AuditLog, Role, User
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


@router.get("/system/users", dependencies=[Depends(require("users.manage"))])
def users(db: DB):
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.name, "branch_id": u.branch_id,
             "is_active": u.is_active} for u in db.execute(select(User).order_by(User.id)).scalars()]


@router.get("/system/roles", dependencies=[Depends(require("users.manage"))])
def roles(db: DB):
    return [{"id": r.id, "name": r.name, "permissions": sorted(p.code for p in r.permissions)}
            for r in db.execute(select(Role).order_by(Role.id)).scalars()]
