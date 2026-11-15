from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.errors import Conflict, Forbidden
from app.models import BillOfMaterials, BomItem, Branch, Customer, Product, Supplier, User
from app.services import inventory, ledger, payments, procurement, reports, sales

D = Decimal


@pytest.fixture()
def world(db):
    b1 = db.execute(select(Branch).where(Branch.code == "HQ")).scalar_one()
    b2 = db.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one()
    sup = Supplier(code="S1", name="Supplier", payment_term_days=30)
    cus = Customer(code="C1", name="Customer", segment="B2B", credit_limit=D("100000"), payment_term_days=30)
    rm = Product(sku="RM1", name="Raw", product_type="RAW_MATERIAL", standard_cost=D("10"))
    rm2 = Product(sku="RM2", name="Raw2", product_type="RAW_MATERIAL", standard_cost=D("5"))
    fg = Product(sku="FG1", name="Finished", product_type="FINISHED_GOOD", sale_price=D("100"))
    db.add_all([sup, cus, rm, rm2, fg])
    db.flush()
    bom = BillOfMaterials(product_id=fg.id, output_qty=D("1"),
                          items=[BomItem(component_id=rm.id, quantity=D("2")), BomItem(component_id=rm2.id, quantity=D("1"))])
    db.add(bom)
    db.flush()
    users = {u.email.split("@")[0]: u for u in db.execute(select(User)).scalars()}
    return dict(b1=b1, b2=b2, sup=sup, cus=cus, rm=rm, rm2=rm2, fg=fg, users=users)


def stock_in(db, w, product, n, cost, branch=None):
    po = procurement.create_po(db, supplier_id=w["sup"].id, branch_id=(branch or w["b2"]).id, order_date=date(2026, 5, 2),
                               items=[{"product_id": product.id, "quantity": n, "unit_price": cost}], user_id=w["users"]["buyer"].id)
    procurement.submit_po(db, po.id)
    procurement.receive_goods(db, po.id, lines=[{"po_item_id": po.items[0].id, "quantity": n}], received_date=date(2026, 5, 2), user_id=None)
    return po


def test_fifo_consumes_oldest_layer_first(db, world):
    w = world
    stock_in(db, w, w["rm"], 10, 10)
    stock_in(db, w, w["rm"], 10, 14)
    cost, layers = inventory.consume_fifo(db, branch_id=w["b2"].id, product_id=w["rm"].id, quantity=D("15"), mtype="WO_CONSUME")
    assert cost == D("10") * 10 + D("14") * 5 and len(layers) == 2
    assert inventory.stock_value(db, w["b2"].id) == D("14") * 5


def test_cannot_consume_more_than_available(db, world):
    stock_in(db, world, world["rm"], 5, 10)
    with pytest.raises(Conflict):
        inventory.consume_fifo(db, branch_id=world["b2"].id, product_id=world["rm"].id, quantity=D("6"), mtype="WO_CONSUME")


def test_po_approval_threshold_and_segregation(db, world):
    w = world
    po = procurement.create_po(db, supplier_id=w["sup"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 2), user_id=w["users"]["buyer"].id,
                               items=[{"product_id": w["rm"].id, "quantity": 10000, "unit_price": 10000}])
    procurement.submit_po(db, po.id)
    assert po.status == "PENDING_APPROVAL"
    with pytest.raises(Conflict):
        procurement.receive_goods(db, po.id, lines=[], received_date=date(2026, 5, 3), user_id=None)
    with pytest.raises(Forbidden):
        procurement.approve_po(db, po.id, w["users"]["buyer"].id)
    procurement.approve_po(db, po.id, w["users"]["procurement"].id)
    assert po.status == "APPROVED"


def test_procure_to_pay_cycle_and_journals(db, world):
    w = world
    po = stock_in(db, w, w["rm"], 10, 10)
    assert po.status == "RECEIVED"
    tb = reports.trial_balance(db, branch_id=None, as_of=date(2026, 5, 31))
    bal = {r["code"]: r for r in tb["rows"]}
    assert bal["1310"]["debit_balance"] == D("100") and bal["2200"]["credit_balance"] == D("100")
    bill = procurement.bill_po(db, po.id, invoice_date=date(2026, 5, 5), user_id=None)
    assert po.status == "BILLED" and bill.due_date == date(2026, 6, 4)
    payments.pay_invoice(db, bill.id, amount=D("40"), payment_date=date(2026, 5, 20), method="CASH", user_id=None)
    assert bill.status == "PARTIALLY_PAID"
    with pytest.raises(Exception, match="exceeds"):
        payments.pay_invoice(db, bill.id, amount=D("61"), payment_date=date(2026, 5, 20), method="CASH", user_id=None)
    payments.pay_invoice(db, bill.id, amount=D("60"), payment_date=date(2026, 5, 21), method="CASH", user_id=None)
    assert bill.status == "PAID" and po.status == "PAID"
    tb = reports.trial_balance(db, branch_id=None, as_of=date(2026, 5, 31))
    assert tb["balanced"]
    assert {r["code"]: r for r in tb["rows"]}["2100"]["credit_balance"] == 0


def test_partial_receipt_status(db, world):
    w = world
    po = procurement.create_po(db, supplier_id=w["sup"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 2), user_id=None,
                               items=[{"product_id": w["rm"].id, "quantity": 10, "unit_price": 10}])
    procurement.submit_po(db, po.id)
    procurement.receive_goods(db, po.id, lines=[{"po_item_id": po.items[0].id, "quantity": 4}], received_date=date(2026, 5, 3), user_id=None)
    assert po.status == "PARTIALLY_RECEIVED"
    with pytest.raises(Exception, match="exceeds"):
        procurement.receive_goods(db, po.id, lines=[{"po_item_id": po.items[0].id, "quantity": 7}], received_date=date(2026, 5, 3), user_id=None)


def test_assembly_costs_finished_good_from_fifo(db, world):
    w = world
    stock_in(db, w, w["rm"], 4, 10)
    stock_in(db, w, w["rm"], 4, 20)
    stock_in(db, w, w["rm2"], 5, 5)
    wo = inventory.create_work_order(db, branch_id=w["b2"].id, product_id=w["fg"].id, quantity=D("3"), user_id=None)
    inventory.complete_work_order(db, wo.id, None)
    # 6 units of RM1: 4@10 + 2@20 = 80, 3 units of RM2 @5 = 15
    assert wo.total_cost == D("95.00") and wo.unit_cost == D("31.6667")
    assert inventory.available(db, w["b2"].id, w["fg"].id) == D("3")
    assert inventory.available(db, w["b2"].id, w["rm"].id) == D("2")


def test_sales_cycle_cogs_and_reservation(db, world):
    w = world
    stock_in(db, w, w["rm"], 10, 10)
    stock_in(db, w, w["rm2"], 10, 5)
    wo = inventory.create_work_order(db, branch_id=w["b2"].id, product_id=w["fg"].id, quantity=D("4"), user_id=None)
    inventory.complete_work_order(db, wo.id, None)
    so = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 10), user_id=None,
                                items=[{"product_id": w["fg"].id, "quantity": 3}])
    sales.confirm_so(db, so.id, None)
    bal = inventory.ensure_balance(db, w["b2"].id, w["fg"].id)
    assert bal.reserved == D("3") and inventory.available(db, w["b2"].id, w["fg"].id) == D("1")
    do = sales.deliver_so(db, so.id, delivery_date=date(2026, 5, 12), user_id=None)
    assert do.cogs_total == D("75.00")  # 3 units * (2*10 + 5)
    inv = sales.invoice_so(db, so.id, invoice_date=date(2026, 5, 13), user_id=None)
    payments.pay_invoice(db, inv.id, amount=inv.total_amount, payment_date=date(2026, 5, 20), method="CASH", user_id=None)
    assert so.status == "PAID"
    inc = reports.income_statement(db, branch_id=None, start=date(2026, 5, 1), end=date(2026, 5, 31))
    assert inc["revenue"]["total"] == D("300.00") and inc["cogs"]["total"] == D("75.00") and inc["gross_profit"] == D("225.00")
    assert reports.balance_sheet(db, branch_id=None, as_of=date(2026, 5, 31))["balanced"]


def test_no_overselling(db, world):
    w = world
    stock_in(db, w, w["rm"], 2, 10)
    sales_item = [{"product_id": w["rm"].id, "quantity": 2, "unit_price": 50}]
    s1 = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 10), user_id=None, items=sales_item)
    s2 = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 10), user_id=None, items=sales_item)
    sales.confirm_so(db, s1.id, None)
    with pytest.raises(Conflict, match="Insufficient"):
        sales.confirm_so(db, s2.id, None)


def test_credit_limit_guard(db, world):
    w = world
    stock_in(db, w, w["rm"], 100, 10)
    big = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 10), user_id=None,
                                 items=[{"product_id": w["rm"].id, "quantity": 10, "unit_price": 10001}])
    with pytest.raises(Conflict, match="Credit limit"):
        sales.confirm_so(db, big.id, None)
    ok = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 10), user_id=None,
                                items=[{"product_id": w["rm"].id, "quantity": 10, "unit_price": 6000}])
    sales.confirm_so(db, ok.id, None)
    sales.deliver_so(db, ok.id, delivery_date=date(2026, 5, 11), user_id=None)
    sales.invoice_so(db, ok.id, invoice_date=date(2026, 5, 11), user_id=None)
    nxt = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 12), user_id=None,
                                 items=[{"product_id": w["rm"].id, "quantity": 10, "unit_price": 4001}])
    with pytest.raises(Conflict, match="Credit limit"):  # 60000 outstanding + 40010 > 100000
        sales.confirm_so(db, nxt.id, None)


def test_cancel_releases_reservation(db, world):
    w = world
    stock_in(db, w, w["rm"], 5, 10)
    so = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, 5, 10), user_id=None,
                                items=[{"product_id": w["rm"].id, "quantity": 5, "unit_price": 20}])
    sales.confirm_so(db, so.id, None)
    sales.cancel_so(db, so.id, None)
    assert inventory.available(db, w["b2"].id, w["rm"].id) == D("5")


def test_transfer_moves_fifo_layers_between_branches(db, world):
    w = world
    stock_in(db, w, w["rm"], 5, 10)
    stock_in(db, w, w["rm"], 5, 12)
    t = inventory.create_transfer(db, from_branch_id=w["b2"].id, to_branch_id=w["b1"].id, items=[(w["rm"].id, D("7"))], user_id=None)
    inventory.dispatch_transfer(db, t.id, None)
    assert t.status == "IN_TRANSIT" and inventory.stock_value(db, w["b1"].id) == 0
    inventory.receive_transfer(db, t.id, None)
    assert inventory.stock_value(db, w["b1"].id) == D("5") * 10 + D("2") * 12
    assert inventory.stock_value(db, w["b2"].id) == D("3") * 12
    with pytest.raises(Conflict):
        inventory.receive_transfer(db, t.id, None)


def test_stock_opname_posts_shrinkage_and_gain(db, world):
    w = world
    stock_in(db, w, w["rm"], 10, 10)
    stock_in(db, w, w["rm2"], 10, 5)
    c = inventory.create_count(db, branch_id=w["b2"].id, count_date=date(2026, 5, 30), user_id=None,
                               counted=[(w["rm"].id, D("8")), (w["rm2"].id, D("12"))])
    inventory.post_count(db, c.id, None)
    by_prod = {i.product_id: i for i in c.items}
    assert by_prod[w["rm"].id].variance_value == D("-20.00") and by_prod[w["rm2"].id].variance_value == D("10.00")
    tb = {r["code"]: r for r in reports.trial_balance(db, branch_id=None, as_of=date(2026, 5, 31))["rows"]}
    assert tb["6900"]["debit_balance"] == D("20.00") and tb["4200"]["credit_balance"] == D("10.00")
    assert inventory.stock_value(db, w["b2"].id) == D("80") + D("60")


def test_reorder_recommendation_uses_recent_consumption(db, world):
    w = world
    w["rm"].reorder_point = D("5")
    stock_in(db, w, w["rm"], 20, 10)
    inventory.consume_fifo(db, branch_id=w["b2"].id, product_id=w["rm"].id, quantity=D("18"), mtype="WO_CONSUME")
    recs = inventory.reorder_recommendations(db, w["b2"].id)
    rec = next(r for r in recs if r["sku"] == "RM1")
    assert rec["avg_daily_usage"] == D("0.6000") and rec["suggested_order_qty"] > 0


def test_ar_aging_buckets(db, world):
    w = world
    stock_in(db, w, w["rm"], 100, 10)
    for month in (1, 3):
        so = sales.create_quotation(db, customer_id=w["cus"].id, branch_id=w["b2"].id, order_date=date(2026, month, 5), user_id=None,
                                    items=[{"product_id": w["rm"].id, "quantity": 1, "unit_price": 1000}])
        sales.confirm_so(db, so.id, None)
        sales.deliver_so(db, so.id, delivery_date=date(2026, month, 6), user_id=None)
        sales.invoice_so(db, so.id, invoice_date=date(2026, month, 7), user_id=None)
    rep = reports.aging(db, invoice_type="AR", branch_id=None, as_of=date(2026, 4, 30))
    # Jan invoice due Feb 6 -> 83 days late; Mar invoice due Apr 6 -> 24 days late
    assert rep["totals"]["d61_90"] == D("1000.00") and rep["totals"]["d0_30"] == D("1000.00")
