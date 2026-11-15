from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select

from app.core.deps import DB, Audit, require
from app.core.errors import Conflict, NotFound
from app.models import BillOfMaterials, BomItem, Branch, Category, Customer, FiscalPeriod, Product, Supplier
from app.schemas.common import ORM, NonNegative, Positive, snapshot

router = APIRouter(prefix="/master", tags=["master data"])
read = Depends(require("master.read"))
write = Depends(require("master.write"))


class BranchOut(ORM):
    id: int
    code: str
    name: str
    branch_type: str
    is_active: bool


class CategoryOut(ORM):
    id: int
    name: str


class ProductIn(BaseModel):
    sku: str = Field(min_length=2, max_length=40)
    name: str
    category_id: int | None = None
    product_type: Literal["RAW_MATERIAL", "FINISHED_GOOD", "SERVICE"]
    uom: str = "PCS"
    standard_cost: NonNegative = Decimal("0")
    sale_price: NonNegative = Decimal("0")
    reorder_point: NonNegative = Decimal("0")
    safety_stock: NonNegative = Decimal("0")


class ProductOut(ORM, ProductIn):
    id: int
    is_active: bool
    category: CategoryOut | None = None


class PartyIn(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    name: str
    tax_id: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    payment_term_days: int = Field(30, ge=0)


class SupplierOut(ORM, PartyIn):
    id: int
    is_active: bool


class CustomerIn(PartyIn):
    segment: Literal["B2B", "B2C"] = "B2B"
    credit_limit: NonNegative = Decimal("0")


class CustomerOut(ORM, CustomerIn):
    id: int
    is_active: bool


class BomItemIn(BaseModel):
    component_id: int
    quantity: Positive


class BomIn(BaseModel):
    product_id: int
    output_qty: Positive = Decimal("1")
    items: list[BomItemIn] = Field(min_length=1)


class BomItemOut(ORM):
    component_id: int
    quantity: Decimal


class BomOut(ORM):
    id: int
    product_id: int
    output_qty: Decimal
    is_active: bool
    items: list[BomItemOut]


@router.get("/branches", response_model=list[BranchOut], dependencies=[read])
def branches(db: DB):
    return db.execute(select(Branch).order_by(Branch.code)).scalars().all()


@router.get("/categories", response_model=list[CategoryOut], dependencies=[read])
def categories(db: DB):
    return db.execute(select(Category).order_by(Category.name)).scalars().all()


@router.get("/products", response_model=list[ProductOut], dependencies=[read])
def products(db: DB, q: str | None = None, product_type: str | None = None):
    stmt = select(Product).order_by(Product.sku)
    if q:
        stmt = stmt.where(or_(Product.sku.ilike(f"%{q}%"), Product.name.ilike(f"%{q}%")))
    if product_type:
        stmt = stmt.where(Product.product_type == product_type)
    return db.execute(stmt).scalars().all()


@router.post("/products", response_model=ProductOut, status_code=201, dependencies=[write])
def create_product(body: ProductIn, db: DB, audit: Audit):
    if db.execute(select(Product.id).where(Product.sku == body.sku)).first():
        raise Conflict("SKU already exists")
    p = Product(**body.model_dump())
    db.add(p)
    db.flush()
    audit.log("CREATE", "product", p.id, after=snapshot(p, "sku", "name", "product_type", "standard_cost", "sale_price"))
    db.commit()
    return p


@router.put("/products/{product_id}", response_model=ProductOut, dependencies=[write])
def update_product(product_id: int, body: ProductIn, db: DB, audit: Audit):
    p = db.get(Product, product_id)
    if p is None:
        raise NotFound("Product not found")
    fields = ("sku", "name", "product_type", "standard_cost", "sale_price", "reorder_point", "safety_stock")
    before = snapshot(p, *fields)
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.flush()
    audit.log("UPDATE", "product", p.id, before=before, after=snapshot(p, *fields))
    db.commit()
    return p


@router.get("/suppliers", response_model=list[SupplierOut], dependencies=[read])
def suppliers(db: DB):
    return db.execute(select(Supplier).order_by(Supplier.code)).scalars().all()


@router.post("/suppliers", response_model=SupplierOut, status_code=201, dependencies=[write])
def create_supplier(body: PartyIn, db: DB, audit: Audit):
    if db.execute(select(Supplier.id).where(Supplier.code == body.code)).first():
        raise Conflict("Supplier code already exists")
    s = Supplier(**body.model_dump())
    db.add(s)
    db.flush()
    audit.log("CREATE", "supplier", s.id, after=snapshot(s, "code", "name"))
    db.commit()
    return s


@router.get("/customers", response_model=list[CustomerOut], dependencies=[read])
def customers(db: DB):
    return db.execute(select(Customer).order_by(Customer.code)).scalars().all()


@router.post("/customers", response_model=CustomerOut, status_code=201, dependencies=[write])
def create_customer(body: CustomerIn, db: DB, audit: Audit):
    if db.execute(select(Customer.id).where(Customer.code == body.code)).first():
        raise Conflict("Customer code already exists")
    c = Customer(**body.model_dump())
    db.add(c)
    db.flush()
    audit.log("CREATE", "customer", c.id, after=snapshot(c, "code", "name", "credit_limit"))
    db.commit()
    return c


@router.put("/customers/{customer_id}", response_model=CustomerOut, dependencies=[write])
def update_customer(customer_id: int, body: CustomerIn, db: DB, audit: Audit):
    c = db.get(Customer, customer_id)
    if c is None:
        raise NotFound("Customer not found")
    fields = ("name", "segment", "credit_limit", "payment_term_days")
    before = snapshot(c, *fields)
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.flush()
    audit.log("UPDATE", "customer", c.id, before=before, after=snapshot(c, *fields))
    db.commit()
    return c


@router.get("/boms", response_model=list[BomOut], dependencies=[read])
def boms(db: DB):
    return db.execute(select(BillOfMaterials)).scalars().all()


@router.post("/boms", response_model=BomOut, status_code=201, dependencies=[write])
def create_bom(body: BomIn, db: DB, audit: Audit):
    product = db.get(Product, body.product_id)
    if product is None or product.product_type != "FINISHED_GOOD":
        raise Conflict("A BOM can only be defined for a finished good")
    if db.execute(select(BillOfMaterials.id).where(BillOfMaterials.product_id == body.product_id)).first():
        raise Conflict("A BOM already exists for this product")
    ids = [i.component_id for i in body.items]
    if len(set(ids)) != len(ids) or body.product_id in ids:
        raise Conflict("Duplicate or self-referencing component")
    bom = BillOfMaterials(product_id=body.product_id, output_qty=body.output_qty,
                          items=[BomItem(component_id=i.component_id, quantity=i.quantity) for i in body.items])
    db.add(bom)
    db.flush()
    audit.log("CREATE", "bom", bom.id, after={"product_id": body.product_id, "components": len(ids)})
    db.commit()
    return bom
