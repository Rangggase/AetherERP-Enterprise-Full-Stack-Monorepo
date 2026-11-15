from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.deps import DB, Audit, perm, require
from app.core.errors import NotFound
from app.models import Invoice, Payment, SalesOrder
from app.schemas.common import NonNegative, Positive
from app.services import payments, sales

router = APIRouter(prefix="/sales", tags=["sales"])
read = Depends(require("sales.read"))


class SOLine(BaseModel):
    product_id: int
    quantity: Positive
    unit_price: NonNegative | None = None


class SOIn(BaseModel):
    customer_id: int
    branch_id: int
    order_date: date = Field(default_factory=date.today)
    items: list[SOLine] = Field(min_length=1)


class DateIn(BaseModel):
    on: date = Field(default_factory=date.today)


class PayIn(BaseModel):
    amount: Positive
    payment_date: date = Field(default_factory=date.today)
    method: str = "BANK_TRANSFER"


def _so(so: SalesOrder) -> dict:
    return {
        "id": so.id, "so_no": so.so_no, "customer_id": so.customer_id, "customer_name": so.customer.name,
        "branch_id": so.branch_id, "order_date": so.order_date, "status": so.status, "total_amount": so.total_amount,
        "items": [{"id": i.id, "product_id": i.product_id, "sku": i.product.sku, "name": i.product.name,
                   "quantity": i.quantity, "unit_price": i.unit_price} for i in so.items],
    }


def _inv(i: Invoice) -> dict:
    return {"id": i.id, "invoice_no": i.invoice_no, "type": i.invoice_type, "branch_id": i.branch_id,
            "supplier_id": i.supplier_id, "customer_id": i.customer_id, "invoice_date": i.invoice_date,
            "due_date": i.due_date, "total_amount": i.total_amount, "paid_amount": i.paid_amount,
            "outstanding": i.outstanding, "status": i.status}


@router.get("/orders", dependencies=[read])
def list_sos(db: DB, status: str | None = None, branch_id: int | None = None, customer_id: int | None = None,
             page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    stmt = select(SalesOrder)
    if status:
        stmt = stmt.where(SalesOrder.status == status)
    if branch_id:
        stmt = stmt.where(SalesOrder.branch_id == branch_id)
    if customer_id:
        stmt = stmt.where(SalesOrder.customer_id == customer_id)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(SalesOrder.id.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [_so(s) for s in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/orders/{so_id}", dependencies=[read])
def get_so(so_id: int, db: DB):
    so = db.get(SalesOrder, so_id)
    if so is None:
        raise NotFound("Sales order not found")
    return _so(so)


@router.post("/orders", status_code=201)
def create_so(body: SOIn, db: DB, audit: Audit, user: perm("sales.write")):
    items = [{k: v for k, v in i.model_dump().items() if v is not None} for i in body.items]
    so = sales.create_quotation(db, customer_id=body.customer_id, branch_id=body.branch_id,
                                order_date=body.order_date, items=items, user_id=user.id)
    audit.log("CREATE", "sales_order", so.id, after={"so_no": so.so_no, "total": str(so.total_amount)})
    db.commit()
    return _so(so)


@router.post("/orders/{so_id}/confirm")
def confirm(so_id: int, db: DB, audit: Audit, user: perm("sales.write")):
    so = sales.confirm_so(db, so_id, user.id)
    audit.log("CONFIRM", "sales_order", so.id, after={"status": so.status})
    db.commit()
    return _so(so)


@router.post("/orders/{so_id}/cancel")
def cancel(so_id: int, db: DB, audit: Audit, user: perm("sales.write")):
    so = sales.cancel_so(db, so_id, user.id)
    audit.log("CANCEL", "sales_order", so.id, after={"status": so.status})
    db.commit()
    return _so(so)


@router.post("/orders/{so_id}/deliver", status_code=201)
def deliver(so_id: int, body: DateIn, db: DB, audit: Audit, user: perm("sales.write", "inventory.write")):
    do = sales.deliver_so(db, so_id, delivery_date=body.on, user_id=user.id)
    audit.log("DELIVER", "delivery_order", do.id, after={"do_no": do.do_no, "cogs": str(do.cogs_total)})
    db.commit()
    return {"id": do.id, "do_no": do.do_no, "cogs_total": do.cogs_total, "journal_entry_id": do.journal_entry_id}


@router.post("/orders/{so_id}/invoice", status_code=201)
def invoice(so_id: int, body: DateIn, db: DB, audit: Audit, user: perm("sales.write")):
    inv = sales.invoice_so(db, so_id, invoice_date=body.on, user_id=user.id)
    audit.log("INVOICE", "invoice", inv.id, after={"invoice_no": inv.invoice_no, "total": str(inv.total_amount)})
    db.commit()
    return _inv(inv)


# ----- invoices & payments (both AR and AP)

inv_router = APIRouter(prefix="/invoices", tags=["invoices & payments"])


@inv_router.get("", dependencies=[Depends(require("accounting.read"))])
def list_invoices(db: DB, type: str | None = None, status: str | None = None, branch_id: int | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    stmt = select(Invoice)
    if type:
        stmt = stmt.where(Invoice.invoice_type == type.upper())
    if status:
        stmt = stmt.where(Invoice.status == status)
    if branch_id:
        stmt = stmt.where(Invoice.branch_id == branch_id)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(Invoice.id.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [_inv(i) for i in rows], "total": total, "page": page, "page_size": page_size}


@inv_router.post("/{invoice_id}/payments", status_code=201)
def pay(invoice_id: int, body: PayIn, db: DB, audit: Audit, user: perm("payments.write")):
    p = payments.pay_invoice(db, invoice_id, amount=body.amount, payment_date=body.payment_date,
                             method=body.method, user_id=user.id)
    audit.log("PAYMENT", "payment", p.id, after={"payment_no": p.payment_no, "amount": str(p.amount), "invoice_id": invoice_id})
    db.commit()
    inv = db.get(Invoice, invoice_id)
    return {"payment_no": p.payment_no, "journal_entry_id": p.journal_entry_id, "invoice": _inv(inv)}
