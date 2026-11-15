from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, NotFound
from app.models import Invoice, Payment, PurchaseOrder, SalesOrder
from app.models.base import money
from app.services import ledger
from app.services.numbering import next_number

CASH_ACCOUNT = "1100"
AP_ACCOUNT = "2100"
AR_ACCOUNT = "1200"


def pay_invoice(db: Session, invoice_id: int, *, amount, payment_date: date, method: str, user_id) -> Payment:
    # Row lock serialises concurrent payments against the same invoice.
    inv = db.execute(select(Invoice).where(Invoice.id == invoice_id).with_for_update()).scalar_one_or_none()
    if inv is None:
        raise NotFound("Invoice not found")
    amount = money(amount)
    if amount <= 0:
        raise DomainError("Payment amount must be positive")
    if inv.status in ("PAID", "VOID"):
        raise Conflict(f"Invoice is {inv.status}")
    if amount > inv.outstanding:
        raise DomainError(f"Payment exceeds outstanding balance of {inv.outstanding}")

    prefix = "PAY-OUT" if inv.invoice_type == "AP" else "PAY-IN"
    pay = Payment(payment_no=next_number(db, prefix, payment_date), invoice_id=inv.id, payment_date=payment_date,
                  amount=amount, method=method, created_by=user_id)
    db.add(pay)
    db.flush()
    if inv.invoice_type == "AP":
        lines = [ledger.debit(AP_ACCOUNT, amount), ledger.credit(CASH_ACCOUNT, amount)]
    else:
        lines = [ledger.debit(CASH_ACCOUNT, amount), ledger.credit(AR_ACCOUNT, amount)]
    je = ledger.post_entry(db, entry_date=payment_date, branch_id=inv.branch_id,
                           description=f"Payment {pay.payment_no} for {inv.invoice_no}", lines=lines,
                           source_type="PAYMENT", source_id=pay.id, user_id=user_id)
    pay.journal_entry_id = je.id
    inv.paid_amount = money(inv.paid_amount + amount)
    inv.status = "PAID" if inv.paid_amount == inv.total_amount else "PARTIALLY_PAID"
    if inv.invoice_type == "AP" and inv.po_id:
        po = db.get(PurchaseOrder, inv.po_id)
        if inv.status == "PAID":
            po.status = "PAID"
    if inv.invoice_type == "AR" and inv.so_id:
        so = db.get(SalesOrder, inv.so_id)
        so.status = "PAID" if inv.status == "PAID" else "PARTIALLY_PAID"
    db.flush()
    return pay
