from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import Money, Qty, TimestampMixin, utcnow
from app.models.master import Customer, Product, Supplier


class PurchaseOrder(TimestampMixin, Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','BILLED','PAID','CANCELLED')",
            name="status",
        ),
        Index("ix_purchase_orders_status_branch", "status", "branch_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    po_no: Mapped[str] = mapped_column(String(24), unique=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    order_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    total_amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    supplier: Mapped[Supplier] = relationship(lazy="joined")
    items: Mapped[list["PurchaseOrderItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0 AND unit_price >= 0", name="positive"),
        CheckConstraint("received_qty >= 0 AND received_qty <= quantity", name="received"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    unit_price: Mapped[Decimal] = mapped_column(Money)
    received_qty: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    product: Mapped[Product] = relationship(lazy="joined")


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_no: Mapped[str] = mapped_column(String(24), unique=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    received_date: Mapped[date] = mapped_column(Date)
    total_value: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    items: Mapped[list["GoodsReceiptItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class GoodsReceiptItem(Base):
    __tablename__ = "goods_receipt_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_id: Mapped[int] = mapped_column(ForeignKey("goods_receipts.id", ondelete="CASCADE"), index=True)
    po_item_id: Mapped[int] = mapped_column(ForeignKey("purchase_order_items.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    unit_cost: Mapped[Decimal] = mapped_column(Money)


class SalesOrder(TimestampMixin, Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('QUOTATION','CONFIRMED_SO','DELIVERED','INVOICED','PARTIALLY_PAID','PAID','CANCELLED')",
            name="status",
        ),
        Index("ix_sales_orders_status_branch", "status", "branch_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    so_no: Mapped[str] = mapped_column(String(24), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    order_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="QUOTATION")
    total_amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    customer: Mapped[Customer] = relationship(lazy="joined")
    items: Mapped[list["SalesOrderItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"
    __table_args__ = (CheckConstraint("quantity > 0 AND unit_price >= 0", name="positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    so_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    unit_price: Mapped[Decimal] = mapped_column(Money)
    product: Mapped[Product] = relationship(lazy="joined")


class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    do_no: Mapped[str] = mapped_column(String(24), unique=True)
    so_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), unique=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    delivery_date: Mapped[date] = mapped_column(Date)
    cogs_total: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("invoice_type IN ('AP','AR')", name="type"),
        CheckConstraint("status IN ('OPEN','PARTIALLY_PAID','PAID','VOID')", name="status"),
        CheckConstraint("paid_amount >= 0 AND paid_amount <= total_amount", name="paid_range"),
        CheckConstraint(
            "(invoice_type = 'AP' AND supplier_id IS NOT NULL AND customer_id IS NULL) OR "
            "(invoice_type = 'AR' AND customer_id IS NOT NULL AND supplier_id IS NULL)",
            name="party",
        ),
        Index("ix_invoices_type_status_due", "invoice_type", "status", "due_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_no: Mapped[str] = mapped_column(String(24), unique=True)
    invoice_type: Mapped[str] = mapped_column(String(2))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), index=True)
    po_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"))
    so_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"))
    invoice_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    total_amount: Mapped[Decimal] = mapped_column(Money)
    paid_amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(14), default="OPEN")
    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))

    @property
    def outstanding(self) -> Decimal:
        return self.total_amount - self.paid_amount


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint("amount > 0", name="amount"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(24), unique=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), index=True)
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Money)
    method: Mapped[str] = mapped_column(String(20), default="BANK_TRANSFER")
    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
