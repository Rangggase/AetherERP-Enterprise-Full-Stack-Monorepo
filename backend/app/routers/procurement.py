from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.deps import DB, Audit, perm, require
from app.core.errors import NotFound
from app.models import GoodsReceipt, PurchaseOrder
from app.schemas.common import NonNegative, Positive
from app.services import procurement

router = APIRouter(prefix="/procurement", tags=["procurement"])
read = Depends(require("procurement.read"))


class POLine(BaseModel):
    product_id: int
    quantity: Positive
    unit_price: NonNegative | None = None


class POIn(BaseModel):
    supplier_id: int
    branch_id: int
    order_date: date = Field(default_factory=date.today)
    items: list[POLine] = Field(min_length=1)


class ReceiptLine(BaseModel):
    po_item_id: int
    quantity: Positive


class ReceiptIn(BaseModel):
    received_date: date = Field(default_factory=date.today)
    lines: list[ReceiptLine] = Field(min_length=1)


class BillIn(BaseModel):
    invoice_date: date = Field(default_factory=date.today)


def _po(po: PurchaseOrder) -> dict:
    return {
        "id": po.id, "po_no": po.po_no, "supplier_id": po.supplier_id, "supplier_name": po.supplier.name,
        "branch_id": po.branch_id, "order_date": po.order_date, "status": po.status, "total_amount": po.total_amount,
        "approved_by": po.approved_by,
        "items": [{"id": i.id, "product_id": i.product_id, "sku": i.product.sku, "name": i.product.name,
                   "quantity": i.quantity, "unit_price": i.unit_price, "received_qty": i.received_qty} for i in po.items],
    }


def _snap(po):
    return {"po_no": po.po_no, "status": po.status, "total": str(po.total_amount)}


@router.get("/purchase-orders", dependencies=[read])
def list_pos(db: DB, status: str | None = None, branch_id: int | None = None, supplier_id: int | None = None,
             page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    stmt = select(PurchaseOrder)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if branch_id:
        stmt = stmt.where(PurchaseOrder.branch_id == branch_id)
    if supplier_id:
        stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(PurchaseOrder.id.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [_po(p) for p in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/purchase-orders/{po_id}", dependencies=[read])
def get_po(po_id: int, db: DB):
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise NotFound("Purchase order not found")
    return _po(po)


@router.post("/purchase-orders", status_code=201)
def create_po(body: POIn, db: DB, audit: Audit, user: perm("procurement.write")):
    items = [{k: v for k, v in i.model_dump().items() if v is not None} for i in body.items]
    po = procurement.create_po(db, supplier_id=body.supplier_id, branch_id=body.branch_id,
                               order_date=body.order_date, items=items, user_id=user.id)
    audit.log("CREATE", "purchase_order", po.id, after=_snap(po))
    db.commit()
    return _po(po)


@router.post("/purchase-orders/{po_id}/submit")
def submit(po_id: int, db: DB, audit: Audit, user: perm("procurement.write")):
    po = db.get(PurchaseOrder, po_id)
    before = _snap(po) if po else None
    po = procurement.submit_po(db, po_id)
    audit.log("SUBMIT", "purchase_order", po.id, before=before, after=_snap(po))
    db.commit()
    return _po(po)


@router.post("/purchase-orders/{po_id}/approve")
def approve(po_id: int, db: DB, audit: Audit, user: perm("procurement.approve")):
    po = db.get(PurchaseOrder, po_id)
    before = _snap(po) if po else None
    po = procurement.approve_po(db, po_id, user.id)
    audit.log("APPROVE", "purchase_order", po.id, before=before, after=_snap(po))
    db.commit()
    return _po(po)


@router.post("/purchase-orders/{po_id}/receive", status_code=201)
def receive(po_id: int, body: ReceiptIn, db: DB, audit: Audit, user: perm("procurement.write", "inventory.write")):
    grn = procurement.receive_goods(db, po_id, lines=[l.model_dump() for l in body.lines],
                                    received_date=body.received_date, user_id=user.id)
    audit.log("RECEIVE", "goods_receipt", grn.id, after={"grn_no": grn.grn_no, "value": str(grn.total_value)})
    db.commit()
    return {"id": grn.id, "grn_no": grn.grn_no, "total_value": grn.total_value, "journal_entry_id": grn.journal_entry_id}


@router.post("/purchase-orders/{po_id}/bill", status_code=201)
def bill(po_id: int, body: BillIn, db: DB, audit: Audit, user: perm("procurement.write")):
    inv = procurement.bill_po(db, po_id, invoice_date=body.invoice_date, user_id=user.id)
    audit.log("BILL", "invoice", inv.id, after={"invoice_no": inv.invoice_no, "total": str(inv.total_amount)})
    db.commit()
    return {"id": inv.id, "invoice_no": inv.invoice_no, "total_amount": inv.total_amount, "due_date": inv.due_date}


@router.get("/goods-receipts", dependencies=[read])
def receipts(db: DB, po_id: int | None = None):
    stmt = select(GoodsReceipt).order_by(GoodsReceipt.id.desc()).limit(200)
    if po_id:
        stmt = stmt.where(GoodsReceipt.po_id == po_id)
    return [{"id": g.id, "grn_no": g.grn_no, "po_id": g.po_id, "received_date": g.received_date,
             "total_value": g.total_value} for g in db.execute(stmt).scalars()]
