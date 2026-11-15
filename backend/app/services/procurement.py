from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import Conflict, DomainError, Forbidden, NotFound
from app.models import GoodsReceipt, GoodsReceiptItem, Invoice, Product, PurchaseOrder, PurchaseOrderItem, Supplier
from app.models.base import ZERO, money, qty as q4
from app.services import inventory, ledger
from app.services.numbering import next_number

GRNI_ACCOUNT = "2200"  # Utang Belum Tertagih
AP_ACCOUNT = "2100"


def _get_po(db: Session, po_id: int) -> PurchaseOrder:
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise NotFound("Purchase order not found")
    return po


def create_po(db: Session, *, supplier_id: int, branch_id: int, order_date: date, items: list[dict], user_id) -> PurchaseOrder:
    if db.get(Supplier, supplier_id) is None:
        raise NotFound("Supplier not found")
    if not items:
        raise DomainError("A purchase order needs at least one line")
    po = PurchaseOrder(po_no=next_number(db, "PO", order_date), supplier_id=supplier_id, branch_id=branch_id,
                       order_date=order_date, status="DRAFT", created_by=user_id)
    total = ZERO
    for it in items:
        p = db.get(Product, it["product_id"])
        if p is None or not p.is_stocked:
            raise DomainError("Purchase lines must reference stocked products")
        price = money(it.get("unit_price", p.standard_cost))
        n = q4(it["quantity"])
        if n <= 0:
            raise DomainError("Quantity must be positive")
        po.items.append(PurchaseOrderItem(product_id=p.id, quantity=n, unit_price=price))
        total += money(n * price)
    po.total_amount = money(total)
    db.add(po)
    db.flush()
    return po


def submit_po(db: Session, po_id: int) -> PurchaseOrder:
    po = _get_po(db, po_id)
    if po.status != "DRAFT":
        raise Conflict(f"Purchase order is {po.status}")
    po.status = "PENDING_APPROVAL" if po.total_amount > get_settings().po_approval_threshold else "APPROVED"
    db.flush()
    return po


def approve_po(db: Session, po_id: int, user_id: int) -> PurchaseOrder:
    po = _get_po(db, po_id)
    if po.status != "PENDING_APPROVAL":
        raise Conflict(f"Purchase order is {po.status}")
    if po.created_by == user_id:
        raise Forbidden("The creator of a purchase order cannot approve it")
    po.status, po.approved_by = "APPROVED", user_id
    db.flush()
    return po


def receive_goods(db: Session, po_id: int, *, lines: list[dict], received_date: date, user_id) -> GoodsReceipt:
    po = _get_po(db, po_id)
    if po.status not in ("APPROVED", "PARTIALLY_RECEIVED"):
        raise Conflict(f"Cannot receive goods for a {po.status} purchase order")
    by_id = {i.id: i for i in po.items}
    grn = GoodsReceipt(grn_no=next_number(db, "GRN", received_date), po_id=po.id, branch_id=po.branch_id,
                       received_date=received_date, created_by=user_id)
    db.add(grn)
    db.flush()
    debits: dict[str, Decimal] = {}
    total = ZERO
    for ln in lines:
        item = by_id.get(ln["po_item_id"])
        if item is None:
            raise DomainError("Line does not belong to this purchase order")
        n = q4(ln["quantity"])
        if n <= 0 or item.received_qty + n > item.quantity:
            raise DomainError(f"Received quantity exceeds the open quantity for {item.product.sku}")
        item.received_qty = q4(item.received_qty + n)
        inventory.receive_stock(db, branch_id=po.branch_id, product_id=item.product_id, quantity=n,
                                unit_cost=item.unit_price, mtype="GRN", ref_type="GRN", ref_id=grn.id, user_id=user_id)
        value = money(n * item.unit_price)
        acct = inventory.inventory_account(item.product)
        debits[acct] = debits.get(acct, ZERO) + value
        total += value
        grn.items.append(GoodsReceiptItem(po_item_id=item.id, product_id=item.product_id, quantity=n, unit_cost=item.unit_price))
    if not grn.items:
        raise DomainError("Nothing to receive")
    je = ledger.post_entry(
        db, entry_date=received_date, branch_id=po.branch_id, description=f"Goods receipt {grn.grn_no} ({po.po_no})",
        lines=[ledger.debit(a, v) for a, v in debits.items()] + [ledger.credit(GRNI_ACCOUNT, total)],
        source_type="GRN", source_id=grn.id, user_id=user_id,
    )
    grn.total_value, grn.journal_entry_id = money(total), je.id
    fully = all(i.received_qty >= i.quantity for i in po.items)
    po.status = "RECEIVED" if fully else "PARTIALLY_RECEIVED"
    db.flush()
    return grn


def bill_po(db: Session, po_id: int, *, invoice_date: date, user_id) -> Invoice:
    po = _get_po(db, po_id)
    if po.status != "RECEIVED":
        raise Conflict("Only fully received purchase orders can be billed")
    amount = money(sum((money(i.received_qty * i.unit_price) for i in po.items), ZERO))
    inv = Invoice(
        invoice_no=next_number(db, "BILL", invoice_date), invoice_type="AP", branch_id=po.branch_id,
        supplier_id=po.supplier_id, po_id=po.id, invoice_date=invoice_date,
        due_date=invoice_date + timedelta(days=po.supplier.payment_term_days), total_amount=amount, status="OPEN",
    )
    db.add(inv)
    db.flush()
    je = ledger.post_entry(
        db, entry_date=invoice_date, branch_id=po.branch_id, description=f"Vendor bill {inv.invoice_no} ({po.po_no})",
        lines=[ledger.debit(GRNI_ACCOUNT, amount), ledger.credit(AP_ACCOUNT, amount)],
        source_type="INVOICE", source_id=inv.id, user_id=user_id,
    )
    inv.journal_entry_id = je.id
    po.status = "BILLED"
    db.flush()
    return inv
