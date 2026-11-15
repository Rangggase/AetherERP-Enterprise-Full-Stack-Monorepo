from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import Money, Qty, TimestampMixin


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"
    __table_args__ = (CheckConstraint("payment_term_days >= 0", name="term"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    tax_id: Mapped[str | None] = mapped_column(String(30))  # NPWP
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    payment_term_days: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("segment IN ('B2B','B2C')", name="segment"),
        CheckConstraint("credit_limit >= 0", name="credit_limit"),
        CheckConstraint("payment_term_days >= 0", name="term"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    segment: Mapped[str] = mapped_column(String(3), default="B2B")
    tax_id: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    credit_limit: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    payment_term_days: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("product_type IN ('RAW_MATERIAL','FINISHED_GOOD','SERVICE')", name="type"),
        CheckConstraint("standard_cost >= 0 AND sale_price >= 0", name="price"),
        CheckConstraint("reorder_point >= 0 AND safety_stock >= 0", name="stock_levels"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), index=True)
    product_type: Mapped[str] = mapped_column(String(15), index=True)
    uom: Mapped[str] = mapped_column(String(12), default="PCS")
    standard_cost: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    sale_price: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    reorder_point: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    safety_stock: Mapped[Decimal] = mapped_column(Qty, default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[Category | None] = relationship(lazy="joined")

    @property
    def is_stocked(self) -> bool:
        return self.product_type != "SERVICE"


class BillOfMaterials(TimestampMixin, Base):
    __tablename__ = "bill_of_materials"
    __table_args__ = (CheckConstraint("output_qty > 0", name="output_qty"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), unique=True)
    output_qty: Mapped[Decimal] = mapped_column(Qty, default=Decimal("1"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    items: Mapped[list["BomItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    product: Mapped[Product] = relationship(lazy="joined")


class BomItem(Base):
    __tablename__ = "bom_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity"),
        Index("uq_bom_items_bom_component", "bom_id", "component_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("bill_of_materials.id", ondelete="CASCADE"))
    component_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    component: Mapped[Product] = relationship(lazy="joined")
