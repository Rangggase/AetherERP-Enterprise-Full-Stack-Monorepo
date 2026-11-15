import threading
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, make_engine
from app.core.errors import Conflict
from app.models import Branch, Customer, FiscalPeriod, JournalEntry, Product, StockBalance, Supplier
from app.seed import seed_reference, seed_users
from app.services import closing, inventory, ledger, procurement, reports, sales

D = Decimal


def hq(db):
    return db.execute(select(Branch).where(Branch.code == "HQ")).scalar_one()


def periods(db):
    return {p.code: p for p in db.execute(select(FiscalPeriod)).scalars()}


def test_periods_close_in_order_and_reopen_in_reverse(db):
    p = periods(db)
    with pytest.raises(Conflict, match="2026-01"):
        closing.close_period(db, p["2026-02"].id)
    closing.close_period(db, p["2026-01"].id)
    closing.close_period(db, p["2026-02"].id)
    with pytest.raises(Conflict, match="2026-02"):
        closing.reopen_period(db, p["2026-01"].id)
    closing.reopen_period(db, p["2026-02"].id)
    closing.reopen_period(db, p["2026-01"].id)
    assert p["2026-01"].status == "OPEN"


def test_open_stock_count_blocks_period_close(db):
    w = db.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one()
    prod = Product(sku="P1", name="P", product_type="RAW_MATERIAL")
    db.add(prod)
    db.flush()
    inventory.create_count(db, branch_id=w.id, count_date=date(2026, 1, 15), counted=[(prod.id, D("1"))], user_id=None)
    with pytest.raises(Conflict, match="stock count"):
        closing.close_period(db, periods(db)["2026-01"].id)


def _year_with_profit(db):
    b = hq(db).id
    ledger.post_entry(db, entry_date=date(2026, 2, 1), branch_id=b, description="capital", lines=[ledger.debit("1100", 1000), ledger.credit("3100", 1000)])
    ledger.post_entry(db, entry_date=date(2026, 3, 1), branch_id=b, description="sale", lines=[ledger.debit("1100", 700), ledger.credit("4100", 700)])
    ledger.post_entry(db, entry_date=date(2026, 4, 1), branch_id=b, description="cogs", lines=[ledger.debit("5100", 200), ledger.credit("1100", 200)])
    ledger.post_entry(db, entry_date=date(2026, 5, 1), branch_id=b, description="rent", lines=[ledger.debit("6200", 150), ledger.credit("1100", 150)])


def test_year_end_closing_moves_profit_to_retained_earnings(db):
    _year_with_profit(db)
    p = periods(db)
    with pytest.raises(Conflict, match="2026-01"):
        closing.close_year(db, 2026, user_id=None)
    for m in range(1, 12):
        closing.close_period(db, p[f"2026-{m:02d}"].id)

    result = closing.close_year(db, 2026, user_id=None)
    assert result["net_income"] == D("350.00") and len(result["entries"]) == 1
    assert p["2026-12"].status == "CLOSED"

    tb = {r["code"]: r for r in reports.trial_balance(db, branch_id=None, as_of=date(2026, 12, 31))["rows"]}
    assert tb["3200"]["credit_balance"] == D("350.00")
    assert "4100" not in tb or tb["4100"]["debit_balance"] == tb["4100"]["credit_balance"] == 0
    assert reports.balance_sheet(db, branch_id=None, as_of=date(2026, 12, 31))["balanced"]
    # Profit reporting for the closed year is unaffected by the closing entry.
    inc = reports.income_statement(db, branch_id=None, start=date(2026, 1, 1), end=date(2026, 12, 31))
    assert inc["net_income"] == D("350.00") and inc["revenue"]["total"] == D("700.00")

    with pytest.raises(Conflict, match="already closed"):
        closing.close_year(db, 2026, user_id=None)
    with pytest.raises(Conflict, match="closing entries"):
        closing.reopen_period(db, p["2026-12"].id)
    closing_entry = db.execute(select(JournalEntry).where(JournalEntry.source_type == "CLOSING")).scalar_one()
    assert sum(l.debit for l in closing_entry.lines) == sum(l.credit for l in closing_entry.lines)


def test_year_end_closing_handles_a_loss(db):
    b = hq(db).id
    ledger.post_entry(db, entry_date=date(2026, 2, 1), branch_id=b, description="rent", lines=[ledger.debit("6200", 90), ledger.credit("1100", 90)])
    p = periods(db)
    for m in range(1, 12):
        closing.close_period(db, p[f"2026-{m:02d}"].id)
    assert closing.close_year(db, 2026, user_id=None)["net_income"] == D("-90.00")
    tb = {r["code"]: r for r in reports.trial_balance(db, branch_id=None, as_of=date(2026, 12, 31))["rows"]}
    assert tb["3200"]["debit_balance"] == D("90.00")


def test_concurrent_confirmations_never_oversell(tmp_path):
    """Eight buyers race for five units on a file-backed database; exactly five may win."""
    eng = make_engine(f"sqlite:///{tmp_path / 'race.db'}")
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, autoflush=False, expire_on_commit=False)
    with Session() as s:
        seed_reference(s)
        seed_users(s, "x")
        branch = s.execute(select(Branch).where(Branch.code == "WH-SBY")).scalar_one()
        sup = Supplier(code="S", name="S")
        cus = Customer(code="C", name="C", credit_limit=D("1000000"))
        prod = Product(sku="HOT", name="Hot item", product_type="FINISHED_GOOD", sale_price=D("10"))
        s.add_all([sup, cus, prod])
        s.flush()
        po = procurement.create_po(s, supplier_id=sup.id, branch_id=branch.id, order_date=date(2026, 3, 1),
                                   items=[{"product_id": prod.id, "quantity": 5, "unit_price": 4}], user_id=None)
        procurement.submit_po(s, po.id)
        procurement.receive_goods(s, po.id, lines=[{"po_item_id": po.items[0].id, "quantity": 5}], received_date=date(2026, 3, 1), user_id=None)
        so_ids = [sales.create_quotation(s, customer_id=cus.id, branch_id=branch.id, order_date=date(2026, 3, 2), user_id=None,
                                         items=[{"product_id": prod.id, "quantity": 1}]).id for _ in range(8)]
        s.commit()
        branch_id, product_id = branch.id, prod.id

    results: list[str] = []
    lock = threading.Lock()

    def buy(so_id: int) -> None:
        with Session() as s:
            try:
                sales.confirm_so(s, so_id, None)
                s.commit()
                outcome = "ok"
            except Conflict:
                s.rollback()
                outcome = "rejected"
            except OperationalError as exc:  # pragma: no cover - would indicate a locking regression
                s.rollback()
                outcome = f"error:{exc}"
        with lock:
            results.append(outcome)

    threads = [threading.Thread(target=buy, args=(i,)) for i in so_ids]
    [t.start() for t in threads]
    [t.join() for t in threads]

    assert sorted(results) == ["ok"] * 5 + ["rejected"] * 3, results
    with Session() as s:
        bal = s.execute(select(StockBalance).where(StockBalance.branch_id == branch_id, StockBalance.product_id == product_id)).scalar_one()
        assert bal.reserved == D("5") and bal.on_hand == D("5")
    eng.dispose()
