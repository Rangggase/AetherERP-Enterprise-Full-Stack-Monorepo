from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import Money, Qty, TimestampMixin, utcnow
from app.models.master import Product


class StockBalance(Base):
    __tablename__ = "stock_balances"
    __table_args__ = (
        Index("uq_stock_balances_branch_product", "branch_id", "product_id", unique=True),
        CheckConstraint("on_hand >= 0 AND reserved >= 0", name="non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    on_hand: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    reserved: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class StockBatch(Base):
    """A FIFO cost layer. Unit cost keeps 4 decimals; extended values are rounded to cents."""

    __tablename__ = "stock_batches"
    __table_args__ = (
        CheckConstraint("qty_remaining >= 0 AND qty_remaining <= qty_received", name="remaining"),
        Index("ix_stock_batches_fifo", "branch_id", "product_id", "received_at", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    unit_cost: Mapped[Decimal] = mapped_column(Qty)
    qty_received: Mapped[Decimal] = mapped_column(Qty)
    qty_remaining: Mapped[Decimal] = mapped_column(Qty)
    source_type: Mapped[str | None] = mapped_column(String(30))
    source_id: Mapped[int | None] = mapped_column()


class StockMovement(Base):
    """Append-only stock card. Quantity is signed (+in / -out)."""

    __tablename__ = "stock_movements"
    __table_args__ = (Index("ix_stock_movements_card", "branch_id", "product_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    movement_type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    unit_cost: Mapped[Decimal] = mapped_column(Qty)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("stock_batches.id"))
    ref_type: Mapped[str | None] = mapped_column(String(30))
    ref_id: Mapped[int | None] = mapped_column()
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class WorkOrder(TimestampMixin, Base):
    __tablename__ = "work_orders"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity"),
        CheckConstraint("status IN ('DRAFT','COMPLETED','CANCELLED')", name="status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    wo_no: Mapped[str] = mapped_column(String(24), unique=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    status: Mapped[str] = mapped_column(String(12), default="DRAFT")
    total_cost: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    unit_cost: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    product: Mapped[Product] = relationship(lazy="joined")


class StockTransfer(TimestampMixin, Base):
    __tablename__ = "stock_transfers"
    __table_args__ = (
        CheckConstraint("from_branch_id <> to_branch_id", name="distinct_branches"),
        CheckConstraint("status IN ('REQUESTED','IN_TRANSIT','RECEIVED','CANCELLED')", name="status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_no: Mapped[str] = mapped_column(String(24), unique=True)
    from_branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    to_branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    status: Mapped[str] = mapped_column(String(12), default="REQUESTED")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    items: Mapped[list["StockTransferItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_id: Mapped[int] = mapped_column(ForeignKey("stock_transfers.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    # FIFO layers detached at dispatch: [{"qty": "...", "unit_cost": "...", "received_at": "..."}]
    layers: Mapped[list | None] = mapped_column(JSON)


class StockCount(TimestampMixin, Base):
    """Physical inventory count (stock opname)."""

    __tablename__ = "stock_counts"
    __table_args__ = (CheckConstraint("status IN ('DRAFT','POSTED')", name="status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    count_no: Mapped[str] = mapped_column(String(24), unique=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    count_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(10), default="DRAFT")
    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    items: Mapped[list["StockCountItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class StockCountItem(Base):
    __tablename__ = "stock_count_items"
    __table_args__ = (Index("uq_stock_count_items", "count_id", "product_id", unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    count_id: Mapped[int] = mapped_column(ForeignKey("stock_counts.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    system_qty: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    counted_qty: Mapped[Decimal] = mapped_column(Qty)
    variance_qty: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    variance_value: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
