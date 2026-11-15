from datetime import date

from sqlalchemy import select

from app.models import AuditLog, Branch, Customer, Product, Supplier
from tests.conftest import PASSWORD, login


def seed_master(db):
    db.add_all([
        Supplier(code="S1", name="Supplier", payment_term_days=30),
        Customer(code="C1", name="Customer", credit_limit=10**9),
        Product(sku="RM1", name="Raw", product_type="RAW_MATERIAL", standard_cost=10, sale_price=25),
    ])
    db.commit()


def test_login_failure_and_me(client):
    assert client.post("/api/v1/auth/login", json={"email": "admin@aether.local", "password": "wrong"}).status_code == 401
    h = login(client, "sales@aether.local")
    me = client.get("/api/v1/auth/me", headers=h).json()
    assert me["role"] == "Sales Staff" and "sales.write" in me["permissions"]
    assert client.get("/api/v1/auth/me").status_code == 401


def test_refresh_rotation_and_reuse_detection(client):
    t = client.post("/api/v1/auth/login", json={"email": "admin@aether.local", "password": PASSWORD}).json()
    second = client.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert second.status_code == 200
    # Replaying the already-rotated token revokes the whole family, including the new one.
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": second.json()["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": t["access_token"]}).status_code == 401


def test_rbac_blocks_unauthorised_actions(client):
    auditor = login(client, "auditor@aether.local")
    r = client.post("/api/v1/accounting/journals", headers=auditor, json={
        "entry_date": "2026-03-10", "branch_id": 1, "description": "nope",
        "lines": [{"account_code": "1100", "debit": 5}, {"account_code": "3100", "credit": 5}]})
    assert r.status_code == 403
    assert client.get("/api/v1/audit-logs", headers=login(client, "sales@aether.local")).status_code == 403
    assert client.get("/api/v1/audit-logs", headers=auditor).status_code == 200


def test_manual_journal_validation_and_reversal_via_api(client):
    h = login(client, "finance@aether.local")
    bad = client.post("/api/v1/accounting/journals", headers=h, json={
        "entry_date": "2026-03-10", "branch_id": 1, "description": "unbalanced",
        "lines": [{"account_code": "1100", "debit": 5}, {"account_code": "3100", "credit": 4}]})
    assert bad.status_code == 422
    ok = client.post("/api/v1/accounting/journals", headers=h, json={
        "entry_date": "2026-03-10", "branch_id": 1, "description": "capital",
        "lines": [{"account_code": "1100", "debit": "100.50"}, {"account_code": "3100", "credit": "100.50"}]})
    assert ok.status_code == 201, ok.text
    rev = client.post(f"/api/v1/accounting/journals/{ok.json()['id']}/reverse?on=2026-03-11", headers=h)
    assert rev.status_code == 201
    assert client.post(f"/api/v1/accounting/journals/{ok.json()['id']}/reverse", headers=h).status_code == 409
    tb = client.get("/api/v1/accounting/reports/trial-balance?as_of=2026-03-31", headers=h).json()
    assert tb["balanced"] is True


def test_closed_period_blocks_posting_via_api(client, db):
    h = login(client, "finance@aether.local")
    periods = client.get("/api/v1/accounting/periods", headers=h).json()
    by_code = {p["code"]: p for p in periods}
    # Periods must close in order: March cannot be closed while January is open.
    assert client.post(f"/api/v1/accounting/periods/{by_code['2026-03']['id']}/close", headers=h).status_code == 409
    for code in ("2026-01", "2026-02", "2026-03"):
        assert client.post(f"/api/v1/accounting/periods/{by_code[code]['id']}/close", headers=h).status_code == 200
    r = client.post("/api/v1/accounting/journals", headers=h, json={
        "entry_date": "2026-03-10", "branch_id": 1, "description": "late posting",
        "lines": [{"account_code": "1100", "debit": 5}, {"account_code": "3100", "credit": 5}]})
    assert r.status_code == 409


def test_order_to_cash_over_http_with_audit_trail(client, db):
    seed_master(db)
    admin = login(client, "admin@aether.local")
    sby = db.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one().id
    sup, cus, prod = (db.execute(select(m)).scalars().first() for m in (Supplier, Customer, Product))

    po = client.post("/api/v1/procurement/purchase-orders", headers=admin, json={
        "supplier_id": sup.id, "branch_id": sby, "order_date": "2026-04-01",
        "items": [{"product_id": prod.id, "quantity": "10", "unit_price": "10"}]}).json()
    assert client.post(f"/api/v1/procurement/purchase-orders/{po['id']}/submit", headers=admin).json()["status"] == "APPROVED"
    grn = client.post(f"/api/v1/procurement/purchase-orders/{po['id']}/receive", headers=admin, json={
        "received_date": "2026-04-02", "lines": [{"po_item_id": po["items"][0]["id"], "quantity": "10"}]})
    assert grn.status_code == 201, grn.text

    so = client.post("/api/v1/sales/orders", headers=admin, json={
        "customer_id": cus.id, "branch_id": sby, "order_date": "2026-04-03",
        "items": [{"product_id": prod.id, "quantity": "4"}]}).json()
    assert client.post(f"/api/v1/sales/orders/{so['id']}/confirm", headers=admin).json()["status"] == "CONFIRMED_SO"
    assert client.post(f"/api/v1/sales/orders/{so['id']}/deliver", headers=admin, json={"on": "2026-04-04"}).status_code == 201
    inv = client.post(f"/api/v1/sales/orders/{so['id']}/invoice", headers=admin, json={"on": "2026-04-05"}).json()
    assert inv["total_amount"] == "100.00"
    paid = client.post(f"/api/v1/invoices/{inv['id']}/payments", headers=admin, json={"amount": "100", "payment_date": "2026-04-06"})
    assert paid.json()["invoice"]["status"] == "PAID"

    inc = client.get("/api/v1/accounting/reports/income-statement?start=2026-04-01&end=2026-04-30", headers=admin).json()
    assert inc["gross_profit"] == "60.00" and inc["gross_margin_pct"] == "60.00"
    dash = client.get("/api/v1/dashboard/overview", headers=admin).json()
    assert dash["kpis"]["net_revenue"] == "100.00" and dash["kpis"]["inventory_value"] == "60.00"
    actions = {a.action for a in db.execute(select(AuditLog)).scalars()}
    assert {"CREATE", "RECEIVE", "CONFIRM", "DELIVER", "INVOICE", "PAYMENT"} <= actions


def test_master_data_create_validate_and_audit(client, db):
    admin = login(client, "admin@aether.local")
    body = {"sku": "FG-NEW", "name": "New item", "product_type": "FINISHED_GOOD", "sale_price": "125000.50", "reorder_point": "10"}
    r = client.post("/api/v1/master/products", headers=admin, json=body)
    assert r.status_code == 201, r.text
    assert r.json()["sale_price"] == "125000.50"
    assert client.post("/api/v1/master/products", headers=admin, json=body).status_code == 409  # duplicate SKU
    assert client.post("/api/v1/master/products", headers=admin, json={**body, "sku": "X2", "sale_price": "-1"}).status_code == 422
    assert client.post("/api/v1/master/products", headers=admin, json={**body, "sku": "X3", "product_type": "GADGET"}).status_code == 422

    cust = client.post("/api/v1/master/customers", headers=admin, json={"code": "C-9", "name": "Buyer", "credit_limit": "5000000", "payment_term_days": 14})
    assert cust.status_code == 201 and cust.json()["segment"] == "B2B"
    assert client.post("/api/v1/master/customers", headers=admin, json={"code": "C-10", "name": "Bad", "email": "not-an-email"}).status_code == 422
    actions = {(a.action, a.entity_type) for a in db.execute(select(AuditLog)).scalars()}
    assert {("CREATE", "product"), ("CREATE", "customer")} <= actions


def test_master_data_writes_require_permission(client):
    sales = login(client, "sales@aether.local")
    assert client.get("/api/v1/master/products", headers=sales).status_code == 200
    r = client.post("/api/v1/master/suppliers", headers=sales, json={"code": "S-1", "name": "Nope"})
    assert r.status_code == 403


def _make_user(client, admin, **over):
    roles = {r["name"]: r["id"] for r in client.get("/api/v1/system/roles", headers=admin).json()}
    body = {"email": "new.person@aether.local", "full_name": "New Person", "password": "Fresh#Start2026", "role_id": roles["Sales Staff"], "branch_id": 1, **over}
    return client.post("/api/v1/system/users", headers=admin, json=body), roles


def test_user_admin_lifecycle(client, db):
    admin = login(client, "admin@aether.local")
    r, roles = _make_user(client, admin)
    assert r.status_code == 201 and "password" not in r.text
    uid = r.json()["id"]
    # new user can sign in with the chosen password and has only sales permissions
    t = client.post("/api/v1/auth/login", json={"email": "new.person@aether.local", "password": "Fresh#Start2026"}).json()
    h = {"Authorization": f"Bearer {t['access_token']}"}
    assert client.get("/api/v1/system/users", headers=h).status_code == 403

    assert _make_user(client, admin)[0].status_code == 409  # duplicate email
    assert _make_user(client, admin, email="x@aether.local", password="short1")[0].status_code == 422
    assert _make_user(client, admin, email="y@aether.local", password="onlyletterspassword")[0].status_code == 422

    # role change takes effect immediately and revokes refresh tokens
    assert client.patch(f"/api/v1/system/users/{uid}", headers=admin, json={"role_id": roles["Auditor"]}).status_code == 200
    assert client.get("/api/v1/audit-logs", headers=h).status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]}).status_code == 401

    # deactivation blocks existing access tokens and new sign-ins
    assert client.patch(f"/api/v1/system/users/{uid}", headers=admin, json={"is_active": False}).json()["is_active"] is False
    assert client.get("/api/v1/auth/me", headers=h).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "new.person@aether.local", "password": "Fresh#Start2026"}).status_code == 401

    audited = [a for a in db.execute(select(AuditLog).where(AuditLog.entity_type == "user")).scalars() if a.action == "UPDATE"]
    assert audited and all("password" not in str(a.before) + str(a.after) for a in audited)


def test_last_admin_and_self_protection(client):
    admin = login(client, "admin@aether.local")
    users = client.get("/api/v1/system/users", headers=admin).json()
    me = next(u for u in users if u["email"] == "admin@aether.local")
    roles = {r["name"]: r["id"] for r in client.get("/api/v1/system/roles", headers=admin).json()}
    assert client.patch(f"/api/v1/system/users/{me['id']}", headers=admin, json={"is_active": False}).status_code == 409
    assert client.patch(f"/api/v1/system/users/{me['id']}", headers=admin, json={"role_id": roles["Auditor"]}).status_code == 409


def test_change_and_reset_password(client):
    admin = login(client, "admin@aether.local")
    t = client.post("/api/v1/auth/login", json={"email": "finance@aether.local", "password": PASSWORD}).json()
    h = {"Authorization": f"Bearer {t['access_token']}"}
    assert client.post("/api/v1/auth/change-password", headers=h, json={"current_password": "wrong", "new_password": "Another#Pass99"}).status_code == 400
    assert client.post("/api/v1/auth/change-password", headers=h, json={"current_password": PASSWORD, "new_password": PASSWORD}).status_code == 422
    assert client.post("/api/v1/auth/change-password", headers=h, json={"current_password": PASSWORD, "new_password": "weak"}).status_code == 422
    assert client.post("/api/v1/auth/change-password", headers=h, json={"current_password": PASSWORD, "new_password": "Another#Pass99"}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": t["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "finance@aether.local", "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "finance@aether.local", "password": "Another#Pass99"}).status_code == 200

    fid = next(u["id"] for u in client.get("/api/v1/system/users", headers=admin).json() if u["email"] == "finance@aether.local")
    assert client.post(f"/api/v1/system/users/{fid}/reset-password", headers=admin, json={"new_password": "Reset#Pass2026"}).status_code == 204
    assert client.post("/api/v1/auth/login", json={"email": "finance@aether.local", "password": "Reset#Pass2026"}).status_code == 200


def test_invoice_detail_for_printing(client, db):
    seed_master(db)
    admin = login(client, "admin@aether.local")
    sby = db.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one().id
    sup, cus, prod = (db.execute(select(m)).scalars().first() for m in (Supplier, Customer, Product))
    po = client.post("/api/v1/procurement/purchase-orders", headers=admin, json={"supplier_id": sup.id, "branch_id": sby, "order_date": "2026-04-01",
        "items": [{"product_id": prod.id, "quantity": "10", "unit_price": "10"}]}).json()
    client.post(f"/api/v1/procurement/purchase-orders/{po['id']}/submit", headers=admin)
    client.post(f"/api/v1/procurement/purchase-orders/{po['id']}/receive", headers=admin, json={"received_date": "2026-04-02", "lines": [{"po_item_id": po["items"][0]["id"], "quantity": "10"}]})
    so = client.post("/api/v1/sales/orders", headers=admin, json={"customer_id": cus.id, "branch_id": sby, "order_date": "2026-04-03", "items": [{"product_id": prod.id, "quantity": "4"}]}).json()
    client.post(f"/api/v1/sales/orders/{so['id']}/confirm", headers=admin)
    client.post(f"/api/v1/sales/orders/{so['id']}/deliver", headers=admin, json={"on": "2026-04-04"})
    inv = client.post(f"/api/v1/sales/orders/{so['id']}/invoice", headers=admin, json={"on": "2026-04-05"}).json()
    client.post(f"/api/v1/invoices/{inv['id']}/payments", headers=admin, json={"amount": "40", "payment_date": "2026-04-06"})
    d = client.get(f"/api/v1/invoices/{inv['id']}", headers=admin).json()
    assert d["party"]["name"] == "Customer" and d["reference"] == so["so_no"]
    assert d["lines"][0]["amount"] == "100.00" and d["outstanding"] == "60.00" and len(d["payments"]) == 1
    assert client.get("/api/v1/invoices/99999", headers=admin).status_code == 404
