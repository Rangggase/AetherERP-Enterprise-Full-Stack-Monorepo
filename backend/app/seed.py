"""Reference data (idempotent) and optional demo data generated through the real services."""
import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Account, BillOfMaterials, BomItem, Branch, Category, Customer, Department, FiscalPeriod, Permission, Product,
    Role, Supplier, User,
)
from app.services import inventory, ledger, payments, procurement, sales

PERMISSIONS = {
    "dashboard.read": "View dashboards",
    "master.read": "View master data",
    "master.write": "Manage master data",
    "accounting.read": "View ledger and financial reports",
    "accounting.post": "Post and reverse journal entries",
    "accounting.close": "Open and close fiscal periods",
    "procurement.read": "View procurement documents",
    "procurement.write": "Create purchase orders, receipts and bills",
    "procurement.approve": "Approve purchase orders",
    "inventory.read": "View stock",
    "inventory.write": "Transfers, assembly and stock opname",
    "sales.read": "View sales documents",
    "sales.write": "Create and process sales orders",
    "payments.write": "Record customer and supplier payments",
    "users.manage": "Manage users and roles",
    "audit.read": "View audit log",
}
READ = [c for c in PERMISSIONS if c.endswith(".read") and c != "audit.read"]
ROLES = {
    "Admin": list(PERMISSIONS),
    "Finance Manager": READ + ["accounting.post", "accounting.close", "payments.write", "master.write"],
    "Procurement Manager": READ + ["procurement.write", "procurement.approve", "inventory.write"],
    "Procurement Staff": READ + ["procurement.write"],
    "Warehouse Staff": READ + ["inventory.write"],
    "Sales Staff": READ + ["sales.write"],
    "Auditor": READ + ["audit.read"],
}

# code, name, type, group, normal
COA = [
    ("1100", "Kas dan Bank", "ASSET", None, "DEBIT"),
    ("1200", "Piutang Usaha", "ASSET", None, "DEBIT"),
    ("1300", "Persediaan Barang Dagang", "ASSET", None, "DEBIT"),
    ("1310", "Persediaan Bahan Baku", "ASSET", None, "DEBIT"),
    ("2100", "Utang Usaha", "LIABILITY", None, "CREDIT"),
    ("2200", "Utang Belum Tertagih", "LIABILITY", None, "CREDIT"),
    ("3100", "Modal Disetor", "EQUITY", None, "CREDIT"),
    ("3200", "Laba Ditahan", "EQUITY", None, "CREDIT"),
    ("4100", "Pendapatan Penjualan", "REVENUE", "REVENUE", "CREDIT"),
    ("4150", "Retur Penjualan", "REVENUE", "REVENUE", "DEBIT"),
    ("4200", "Keuntungan Selisih Persediaan", "REVENUE", "REVENUE", "CREDIT"),
    ("5100", "Harga Pokok Penjualan", "EXPENSE", "COGS", "DEBIT"),
    ("6100", "Beban Gaji", "EXPENSE", "OPEX", "DEBIT"),
    ("6200", "Beban Sewa", "EXPENSE", "OPEX", "DEBIT"),
    ("6300", "Beban Utilitas", "EXPENSE", "OPEX", "DEBIT"),
    ("6900", "Kerugian Selisih Persediaan", "EXPENSE", "OPEX", "DEBIT"),
]

BRANCHES = [
    ("HQ", "Kantor Pusat Jakarta", "HEAD_OFFICE"),
    ("WH-SBY", "Gudang Surabaya", "WAREHOUSE"),
    ("WH-BDG", "Gudang Bandung", "WAREHOUSE"),
]


def seed_reference(db: Session, year: int = 2026) -> None:
    perms = {}
    for code, desc in PERMISSIONS.items():
        p = db.execute(select(Permission).where(Permission.code == code)).scalar_one_or_none()
        perms[code] = p or Permission(code=code, description=desc)
        db.add(perms[code])
    for name, codes in ROLES.items():
        role = db.execute(select(Role).where(Role.name == name)).scalar_one_or_none() or Role(name=name)
        role.permissions = [perms[c] for c in codes]
        db.add(role)
    for code, name, atype, group, normal in COA:
        if not db.execute(select(Account).where(Account.code == code)).scalar_one_or_none():
            db.add(Account(code=code, name=name, account_type=atype, report_group=group, normal_balance=normal))
    for code, name, btype in BRANCHES:
        if not db.execute(select(Branch).where(Branch.code == code)).scalar_one_or_none():
            db.add(Branch(code=code, name=name, branch_type=btype))
    for m in range(1, 13):
        code = f"{year}-{m:02d}"
        if not db.execute(select(FiscalPeriod).where(FiscalPeriod.code == code)).scalar_one_or_none():
            db.add(FiscalPeriod(code=code, start_date=date(year, m, 1), end_date=date(year, m, calendar.monthrange(year, m)[1]), status="OPEN"))
    db.flush()


def _audit_demo_documents(db: Session, users: dict[str, User]) -> None:
    """Audit entries for the generated documents, so the activity feed is populated on first run."""
    from app.models import DeliveryOrder, GoodsReceipt, PurchaseOrder, SalesOrder, WorkOrder
    from app.services import audit

    for model, action, who, label, attr in (
        (PurchaseOrder, "CREATE", "buyer", "purchase_order", "po_no"),
        (GoodsReceipt, "RECEIVE", "warehouse", "goods_receipt", "grn_no"),
        (WorkOrder, "COMPLETE", "warehouse", "work_order", "wo_no"),
        (SalesOrder, "CREATE", "sales", "sales_order", "so_no"),
        (DeliveryOrder, "DELIVER", "warehouse", "delivery_order", "do_no"),
    ):
        for row in db.execute(select(model)).scalars():
            audit.record(db, user_id=users[who].id, action=action, entity_type=label, entity_id=row.id,
                         after={attr: getattr(row, attr)}, ip="127.0.0.1")


def _user(db, email, name, role, branch_id, password):
    u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if u:
        return u
    r = db.execute(select(Role).where(Role.name == role)).scalar_one()
    u = User(email=email, full_name=name, password_hash=hash_password(password), role_id=r.id, branch_id=branch_id)
    db.add(u)
    db.flush()
    return u


def seed_users(db: Session, password: str) -> dict[str, User]:
    hq = db.execute(select(Branch).where(Branch.code == "HQ")).scalar_one()
    wh = db.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one()
    return {
        "admin": _user(db, "admin@aether.local", "System Admin", "Admin", hq.id, password),
        "finance": _user(db, "finance@aether.local", "Finance Manager", "Finance Manager", hq.id, password),
        "buyer": _user(db, "buyer@aether.local", "Procurement Staff", "Procurement Staff", hq.id, password),
        "pmanager": _user(db, "procurement@aether.local", "Procurement Manager", "Procurement Manager", hq.id, password),
        "warehouse": _user(db, "warehouse@aether.local", "Warehouse Staff", "Warehouse Staff", wh.id, password),
        "sales": _user(db, "sales@aether.local", "Sales Staff", "Sales Staff", hq.id, password),
        "auditor": _user(db, "auditor@aether.local", "Auditor", "Auditor", hq.id, password),
    }


def seed_demo(db: Session, password: str = "Aether#Demo2026") -> None:
    if db.execute(select(Product)).first():
        return
    users = seed_users(db, password)
    admin, pm = users["admin"], users["pmanager"]
    hq = db.execute(select(Branch).where(Branch.code == "HQ")).scalar_one()
    sby = db.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one()
    bdg = db.execute(select(Branch).where(Branch.code == "WH-BDG")).scalar_one()
    db.add(Department(branch_id=hq.id, code="FIN", name="Finance"))
    db.add(Department(branch_id=sby.id, code="WHS", name="Warehouse Operations"))

    cats = {n: Category(name=n) for n in ("Electronics", "Components", "Accessories")}
    db.add_all(cats.values())
    db.flush()
    suppliers = [
        Supplier(code="SUP-001", name="PT Mitra Komponen Nusantara", tax_id="01.234.567.8-091.000", payment_term_days=30),
        Supplier(code="SUP-002", name="CV Sinar Elektronik", tax_id="02.345.678.9-012.000", payment_term_days=14),
    ]
    customers = [
        Customer(code="CUS-001", name="PT Retail Sentosa", segment="B2B", credit_limit=Decimal("500000000"), payment_term_days=30),
        Customer(code="CUS-002", name="Toko Digital Makmur", segment="B2B", credit_limit=Decimal("150000000"), payment_term_days=14),
        Customer(code="CUS-003", name="Andi Pratama", segment="B2C", credit_limit=Decimal("10000000"), payment_term_days=0),
    ]
    db.add_all(suppliers + customers)

    def prod(sku, name, cat, ptype, cost, price, rop, safety, uom="PCS"):
        p = Product(sku=sku, name=name, category_id=cats[cat].id, product_type=ptype, uom=uom, standard_cost=Decimal(cost),
                    sale_price=Decimal(price), reorder_point=Decimal(rop), safety_stock=Decimal(safety))
        db.add(p)
        return p

    pcb = prod("RM-PCB-01", "Mainboard PCB", "Components", "RAW_MATERIAL", "120000", "0", "100", "40")
    bat = prod("RM-BAT-01", "Lithium Battery 3000mAh", "Components", "RAW_MATERIAL", "85000", "0", "100", "40")
    cas = prod("RM-CAS-01", "Aluminium Casing", "Components", "RAW_MATERIAL", "60000", "0", "80", "30")
    hub = prod("FG-HUB-01", "Smart Hub Controller", "Electronics", "FINISHED_GOOD", "0", "650000", "30", "10")
    cab = prod("FG-CAB-01", "USB-C Cable 1m", "Accessories", "FINISHED_GOOD", "18000", "45000", "200", "80")
    svc = prod("SV-INS-01", "Installation Service", "Electronics", "SERVICE", "0", "150000", "0", "0")
    db.flush()
    bom = BillOfMaterials(product_id=hub.id, output_qty=Decimal("1"))
    bom.items = [BomItem(component_id=pcb.id, quantity=Decimal("1")), BomItem(component_id=bat.id, quantity=Decimal("1")),
                 BomItem(component_id=cas.id, quantity=Decimal("1"))]
    db.add(bom)
    db.flush()

    # Opening capital
    ledger.post_entry(db, entry_date=date(2026, 6, 1), branch_id=hq.id, description="Opening capital injection",
                      lines=[ledger.debit("1100", "2000000000"), ledger.credit("3100", "2000000000")], source_type="OPENING", user_id=admin.id)

    sup1, sup2 = suppliers
    cus1, cus2, cus3 = customers
    for month, (rm_n, price_bump, sale_n) in zip(range(6, 12), [(120, 0, 20), (120, 3000, 28), (140, 5000, 36), (140, 4000, 44), (160, 7000, 52), (160, 6000, 60)]):
        d = date(2026, month, 5)
        po = procurement.create_po(db, supplier_id=sup1.id, branch_id=sby.id, order_date=d, user_id=users["buyer"].id, items=[
            {"product_id": pcb.id, "quantity": rm_n, "unit_price": 120000 + price_bump},
            {"product_id": bat.id, "quantity": rm_n, "unit_price": 85000 + price_bump // 2},
            {"product_id": cas.id, "quantity": rm_n, "unit_price": 60000 + price_bump // 3}])
        procurement.submit_po(db, po.id)
        if po.status == "PENDING_APPROVAL":
            procurement.approve_po(db, po.id, pm.id)
        procurement.receive_goods(db, po.id, lines=[{"po_item_id": i.id, "quantity": i.quantity} for i in po.items], received_date=d, user_id=admin.id)
        inv = procurement.bill_po(db, po.id, invoice_date=d, user_id=admin.id)
        if month < 11:
            payments.pay_invoice(db, inv.id, amount=inv.total_amount, payment_date=date(2026, month, 25), method="BANK_TRANSFER", user_id=admin.id)

        po2 = procurement.create_po(db, supplier_id=sup2.id, branch_id=sby.id, order_date=d, user_id=users["buyer"].id,
                                    items=[{"product_id": cab.id, "quantity": 400, "unit_price": 18000 + price_bump // 10}])
        procurement.submit_po(db, po2.id)
        procurement.receive_goods(db, po2.id, lines=[{"po_item_id": i.id, "quantity": i.quantity} for i in po2.items], received_date=d, user_id=admin.id)

        wo = inventory.create_work_order(db, branch_id=sby.id, product_id=hub.id, quantity=Decimal(sale_n + 8), user_id=admin.id)
        inventory.complete_work_order(db, wo.id, admin.id, on=d)

        for cust, units, hubs in ((cus1, 40, sale_n // 2), (cus2, 60, sale_n // 2 - 4), (cus3, 3, 0)):
            lines = [{"product_id": cab.id, "quantity": units}]
            if hubs > 0:
                lines.append({"product_id": hub.id, "quantity": hubs})
            lines.append({"product_id": svc.id, "quantity": 1})
            so = sales.create_quotation(db, customer_id=cust.id, branch_id=sby.id, order_date=date(2026, month, 12), items=lines, user_id=users["sales"].id)
            sales.confirm_so(db, so.id, users["sales"].id)
            sales.deliver_so(db, so.id, delivery_date=date(2026, month, 14), user_id=admin.id)
            si = sales.invoice_so(db, so.id, invoice_date=date(2026, month, 15), user_id=admin.id)
            if month < 11 and cust is not cus2 or month < 9:
                payments.pay_invoice(db, si.id, amount=si.total_amount, payment_date=date(2026, month, 28), method="BANK_TRANSFER", user_id=admin.id)

    ledger.post_entry(db, entry_date=date(2026, 11, 1), branch_id=hq.id, description="November rent and utilities",
                      lines=[ledger.debit("6200", "4500000"), ledger.debit("6300", "850000"), ledger.credit("1100", "5350000")],
                      source_type="MANUAL", user_id=admin.id)
    for m in range(6, 12):
        ledger.post_entry(db, entry_date=date(2026, m, 28), branch_id=hq.id, description=f"Payroll {calendar.month_name[m]}",
                          lines=[ledger.debit("6100", "12000000"), ledger.credit("1100", "12000000")], source_type="MANUAL", user_id=admin.id)
    # A cross-branch transfer so the Bandung warehouse has stock
    t = inventory.create_transfer(db, from_branch_id=sby.id, to_branch_id=bdg.id, items=[(cab.id, Decimal("100"))], user_id=admin.id)
    inventory.dispatch_transfer(db, t.id, admin.id)
    inventory.receive_transfer(db, t.id, admin.id)
    db.flush()
    _audit_demo_documents(db, users)
    db.flush()
