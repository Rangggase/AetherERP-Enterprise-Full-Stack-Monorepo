from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, NotFound
from app.models import Customer, DeliveryOrder, Invoice, Product, SalesOrder, SalesOrderItem
from app.models.base import ZERO, money, qty as q4
from app.services import inventory, ledger
from app.services.numbering import next_number

AR_ACCOUNT = "1200"
REVENUE_ACCOUNT = "4100"
COGS_ACCOUNT = "5100"


def _get_so(db: Session, so_id: int) -> SalesOrder:
    so = db.get(SalesOrder, so_id)
    if so is None:
        raise NotFound("Sales order not found")
    return so


def create_quotation(db: Session, *, customer_id: int, branch_id: int, order_date: date, items: list[dict], user_id) -> SalesOrder:
    customer = db.get(Customer, customer_id)
    if customer is None or not customer.is_active:
        raise NotFound("Customer not found")
    if not items:
        raise DomainError("A sales order needs at least one line")
    so = SalesOrder(so_no=next_number(db, "SO", order_date), customer_id=customer_id, branch_id=branch_id,
                    order_date=order_date, status="QUOTATION", created_by=user_id)
    total = ZERO
    for it in items:
        p = db.get(Product, it["product_id"])
        if p is None or not p.is_active:
            raise NotFound("Product not found")
        n = q4(it["quantity"])
        if n <= 0:
            raise DomainError("Quantity must be positive")
        price = money(it.get("unit_price", p.sale_price))
        so.items.append(SalesOrderItem(product_id=p.id, quantity=n, unit_price=price))
        total += money(n * price)
    so.total_amount = money(total)
    db.add(so)
    db.flush()
    return so


def receivable_exposure(db: Session, customer_id: int) -> Decimal:
    return money(
        db.execute(
            select(func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).where(
                Invoice.invoice_type == "AR", Invoice.customer_id == customer_id, Invoice.status.in_(("OPEN", "PARTIALLY_PAID"))
            )
        ).scalar_one()
    )


def confirm_so(db: Session, so_id: int, user_id) -> SalesOrder:
    so = _get_so(db, so_id)
    if so.status != "QUOTATION":
        raise Conflict(f"Sales order is {so.status}")
    exposure = receivable_exposure(db, so.customer_id)
    limit = so.customer.credit_limit
    if exposure + so.total_amount > limit:
        raise Conflict(
            f"Credit limit exceeded: outstanding {exposure} + order {so.total_amount} > limit {limit}"
        )
    # Reserve atomically; any shortage raises and the caller's transaction rolls everything back.
    for item in so.items:
        if item.product.is_stocked:
            try:
                inventory.reserve(db, so.branch_id, item.product_id, item.quantity)
            except Conflict:
                raise Conflict(f"Insufficient available stock for {item.product.sku}") from None
    so.status = "CONFIRMED_SO"
    db.flush()
    return so


def cancel_so(db: Session, so_id: int, user_id) -> SalesOrder:
    so = _get_so(db, so_id)
    if so.status not in ("QUOTATION", "CONFIRMED_SO"):
        raise Conflict(f"Sales order is {so.status} and can no longer be cancelled")
    if so.status == "CONFIRMED_SO":
        for item in so.items:
            if item.product.is_stocked:
                inventory.release(db, so.branch_id, item.product_id, item.quantity)
    so.status = "CANCELLED"
    db.flush()
    return so


def deliver_so(db: Session, so_id: int, *, delivery_date: date, user_id) -> DeliveryOrder:
    so = _get_so(db, so_id)
    if so.status != "CONFIRMED_SO":
        raise Conflict(f"Sales order is {so.status}")
    do = DeliveryOrder(do_no=next_number(db, "DO", delivery_date), so_id=so.id, branch_id=so.branch_id,
                       delivery_date=delivery_date, created_by=user_id)
    db.add(do)
    db.flush()
    credits: dict[str, Decimal] = {}
    total = ZERO
    for item in so.items:
        if not item.product.is_stocked:
            continue
        cost, _ = inventory.consume_fifo(db, branch_id=so.branch_id, product_id=item.product_id, quantity=item.quantity,
                                         mtype="SALE", ref_type="DELIVERY", ref_id=do.id, user_id=user_id, from_reserved=True)
        acct = inventory.inventory_account(item.product)
        credits[acct] = credits.get(acct, ZERO) + cost
        total += cost
    do.cogs_total = money(total)
    if total > 0:
        je = ledger.post_entry(
            db, entry_date=delivery_date, branch_id=so.branch_id, description=f"Delivery {do.do_no} ({so.so_no})",
            lines=[ledger.debit(COGS_ACCOUNT, total)] + [ledger.credit(a, v) for a, v in credits.items()],
            source_type="DELIVERY", source_id=do.id, user_id=user_id,
        )
        do.journal_entry_id = je.id
    so.status = "DELIVERED"
    db.flush()
    return do


def invoice_so(db: Session, so_id: int, *, invoice_date: date, user_id) -> Invoice:
    so = _get_so(db, so_id)
    if so.status != "DELIVERED":
        raise Conflict("Only delivered sales orders can be invoiced")
    inv = Invoice(
        invoice_no=next_number(db, "INV", invoice_date), invoice_type="AR", branch_id=so.branch_id,
        customer_id=so.customer_id, so_id=so.id, invoice_date=invoice_date,
        due_date=invoice_date + timedelta(days=so.customer.payment_term_days), total_amount=so.total_amount, status="OPEN",
    )
    db.add(inv)
    db.flush()
    je = ledger.post_entry(
        db, entry_date=invoice_date, branch_id=so.branch_id, description=f"Invoice {inv.invoice_no} ({so.so_no})",
        lines=[ledger.debit(AR_ACCOUNT, inv.total_amount), ledger.credit(REVENUE_ACCOUNT, inv.total_amount)],
        source_type="INVOICE", source_id=inv.id, user_id=user_id,
    )
    inv.journal_entry_id = je.id
    so.status = "INVOICED"
    db.flush()
    return inv
