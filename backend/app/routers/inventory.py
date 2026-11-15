from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.deps import DB, Audit, perm, require
from app.core.errors import NotFound
from app.models import Product, StockBalance, StockBatch, StockCount, StockMovement, StockTransfer, WorkOrder
from app.schemas.common import NonNegative, Positive
from app.services import inventory

router = APIRouter(prefix="/inventory", tags=["inventory"])
read = Depends(require("inventory.read"))


class ItemQty(BaseModel):
    product_id: int
    quantity: Positive


class TransferIn(BaseModel):
    from_branch_id: int
    to_branch_id: int
    items: list[ItemQty] = Field(min_length=1)


class WorkOrderIn(BaseModel):
    branch_id: int
    product_id: int
    quantity: Positive


class CountLine(BaseModel):
    product_id: int
    counted_qty: NonNegative


class CountIn(BaseModel):
    branch_id: int
    count_date: date = Field(default_factory=date.today)
    lines: list[CountLine] = Field(min_length=1)


def _transfer(t: StockTransfer) -> dict:
    return {"id": t.id, "transfer_no": t.transfer_no, "from_branch_id": t.from_branch_id, "to_branch_id": t.to_branch_id,
            "status": t.status, "items": [{"product_id": i.product_id, "quantity": i.quantity} for i in t.items]}


def _wo(w: WorkOrder) -> dict:
    return {"id": w.id, "wo_no": w.wo_no, "branch_id": w.branch_id, "product_id": w.product_id, "sku": w.product.sku,
            "quantity": w.quantity, "status": w.status, "total_cost": w.total_cost, "unit_cost": w.unit_cost}


def _count(c: StockCount) -> dict:
    return {"id": c.id, "count_no": c.count_no, "branch_id": c.branch_id, "count_date": c.count_date, "status": c.status,
            "journal_entry_id": c.journal_entry_id,
            "items": [{"product_id": i.product_id, "system_qty": i.system_qty, "counted_qty": i.counted_qty,
                       "variance_qty": i.variance_qty, "variance_value": i.variance_value} for i in c.items]}


@router.get("/balances", dependencies=[read])
def balances(db: DB, branch_id: int | None = None, low_only: bool = False):
    value = (
        select(StockBatch.branch_id, StockBatch.product_id, func.sum(StockBatch.qty_remaining * StockBatch.unit_cost).label("v"))
        .group_by(StockBatch.branch_id, StockBatch.product_id).subquery()
    )
    stmt = (
        select(StockBalance, Product, func.coalesce(value.c.v, 0))
        .join(Product, Product.id == StockBalance.product_id)
        .outerjoin(value, (value.c.branch_id == StockBalance.branch_id) & (value.c.product_id == StockBalance.product_id))
        .order_by(Product.sku, StockBalance.branch_id)
    )
    if branch_id:
        stmt = stmt.where(StockBalance.branch_id == branch_id)
    out = []
    for b, p, v in db.execute(stmt):
        avail = b.on_hand - b.reserved
        low = avail <= p.reorder_point and p.reorder_point > 0
        if low_only and not low:
            continue
        out.append({"branch_id": b.branch_id, "product_id": p.id, "sku": p.sku, "name": p.name, "uom": p.uom,
                    "on_hand": b.on_hand, "reserved": b.reserved, "available": avail,
                    "reorder_point": p.reorder_point, "is_low": low, "value": Decimal(v).quantize(Decimal("0.01"))})
    return out


@router.get("/movements", dependencies=[read])
def movements(db: DB, product_id: int | None = None, branch_id: int | None = None,
              page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)):
    stmt = select(StockMovement)
    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
    if branch_id:
        stmt = stmt.where(StockMovement.branch_id == branch_id)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(StockMovement.id.desc()).offset((page - 1) * page_size).limit(page_size)).scalars()
    return {"total": total, "page": page, "page_size": page_size, "items": [
        {"id": m.id, "branch_id": m.branch_id, "product_id": m.product_id, "type": m.movement_type, "quantity": m.quantity,
         "unit_cost": m.unit_cost, "ref_type": m.ref_type, "ref_id": m.ref_id, "created_at": m.created_at} for m in rows]}


@router.get("/valuation", dependencies=[read])
def valuation(db: DB, branch_id: int | None = None):
    return {"branch_id": branch_id, "fifo_value": inventory.stock_value(db, branch_id)}


@router.get("/reorder-recommendations", dependencies=[read])
def reorder(db: DB, branch_id: int | None = None):
    return inventory.reorder_recommendations(db, branch_id)


@router.get("/transfers", dependencies=[read])
def transfers(db: DB):
    return [_transfer(t) for t in db.execute(select(StockTransfer).order_by(StockTransfer.id.desc()).limit(200)).scalars()]


@router.post("/transfers", status_code=201)
def create_transfer(body: TransferIn, db: DB, audit: Audit, user: perm("inventory.write")):
    t = inventory.create_transfer(db, from_branch_id=body.from_branch_id, to_branch_id=body.to_branch_id,
                                  items=[(i.product_id, i.quantity) for i in body.items], user_id=user.id)
    audit.log("CREATE", "stock_transfer", t.id, after={"transfer_no": t.transfer_no})
    db.commit()
    return _transfer(t)


@router.post("/transfers/{transfer_id}/dispatch")
def dispatch(transfer_id: int, db: DB, audit: Audit, user: perm("inventory.write")):
    t = inventory.dispatch_transfer(db, transfer_id, user.id)
    audit.log("DISPATCH", "stock_transfer", t.id, after={"status": t.status})
    db.commit()
    return _transfer(t)


@router.post("/transfers/{transfer_id}/receive")
def receive(transfer_id: int, db: DB, audit: Audit, user: perm("inventory.write")):
    t = inventory.receive_transfer(db, transfer_id, user.id)
    audit.log("RECEIVE", "stock_transfer", t.id, after={"status": t.status})
    db.commit()
    return _transfer(t)


@router.get("/work-orders", dependencies=[read])
def work_orders(db: DB):
    return [_wo(w) for w in db.execute(select(WorkOrder).order_by(WorkOrder.id.desc()).limit(200)).scalars()]


@router.post("/work-orders", status_code=201)
def create_wo(body: WorkOrderIn, db: DB, audit: Audit, user: perm("inventory.write")):
    wo = inventory.create_work_order(db, branch_id=body.branch_id, product_id=body.product_id, quantity=body.quantity, user_id=user.id)
    audit.log("CREATE", "work_order", wo.id, after={"wo_no": wo.wo_no})
    db.commit()
    return _wo(wo)


@router.post("/work-orders/{wo_id}/complete")
def complete_wo(wo_id: int, db: DB, audit: Audit, user: perm("inventory.write")):
    wo = inventory.complete_work_order(db, wo_id, user.id)
    audit.log("COMPLETE", "work_order", wo.id, after={"total_cost": str(wo.total_cost), "unit_cost": str(wo.unit_cost)})
    db.commit()
    return _wo(wo)


@router.get("/stock-counts", dependencies=[read])
def counts(db: DB):
    return [_count(c) for c in db.execute(select(StockCount).order_by(StockCount.id.desc()).limit(100)).scalars()]


@router.post("/stock-counts", status_code=201)
def create_count(body: CountIn, db: DB, audit: Audit, user: perm("inventory.write")):
    c = inventory.create_count(db, branch_id=body.branch_id, count_date=body.count_date,
                               counted=[(l.product_id, l.counted_qty) for l in body.lines], user_id=user.id)
    audit.log("CREATE", "stock_count", c.id, after={"count_no": c.count_no})
    db.commit()
    return _count(c)


@router.post("/stock-counts/{count_id}/post")
def post_count(count_id: int, db: DB, audit: Audit, user: perm("inventory.write", "accounting.post")):
    c = inventory.post_count(db, count_id, user.id)
    audit.log("POST", "stock_count", c.id, after={"journal_entry_id": c.journal_entry_id})
    db.commit()
    return _count(c)
