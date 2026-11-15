from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.errors import Conflict, DomainError
from app.models import Branch, FiscalPeriod, JournalEntry
from app.models.guards import ImmutableRecordError
from app.services import ledger, reports


def hq(db):
    return db.execute(select(Branch).where(Branch.code == "HQ")).scalar_one()


def post(db, lines, d=date(2026, 3, 10)):
    return ledger.post_entry(db, entry_date=d, branch_id=hq(db).id, description="test entry", lines=lines)


def test_balanced_entry_posts(db):
    e = post(db, [ledger.debit("1100", 1000), ledger.credit("3100", 1000)])
    assert e.entry_no.startswith("JE-2026-") and len(e.lines) == 2


def test_unbalanced_entry_rejected(db):
    with pytest.raises(DomainError, match="unbalanced"):
        post(db, [ledger.debit("1100", 1000), ledger.credit("3100", 999.99)])


def test_single_line_rejected(db):
    with pytest.raises(DomainError, match="at least two"):
        post(db, [ledger.debit("1100", 1000)])


def test_closed_period_rejected(db):
    db.execute(select(FiscalPeriod).where(FiscalPeriod.code == "2026-03")).scalar_one().status = "CLOSED"
    db.flush()
    with pytest.raises(Conflict, match="closed"):
        post(db, [ledger.debit("1100", 10), ledger.credit("3100", 10)])


def test_date_outside_any_period_rejected(db):
    with pytest.raises(DomainError, match="No fiscal period"):
        post(db, [ledger.debit("1100", 10), ledger.credit("3100", 10)], d=date(2030, 1, 1))


def test_posted_entry_is_immutable(db):
    e = post(db, [ledger.debit("1100", 10), ledger.credit("3100", 10)])
    db.commit()
    e.description = "tampered"
    with pytest.raises(ImmutableRecordError):
        db.flush()
    db.rollback()
    e = db.get(JournalEntry, e.id)
    e.lines[0].debit = Decimal("99")
    with pytest.raises(ImmutableRecordError):
        db.flush()


def test_reversal_nets_to_zero_and_cannot_repeat(db):
    e = post(db, [ledger.debit("1100", 500), ledger.credit("4100", 500)])
    rev = ledger.reverse_entry(db, e.id, user_id=None, on=date(2026, 3, 11))
    assert e.status == "REVERSED" and rev.reverses_id == e.id
    tb = reports.trial_balance(db, branch_id=None, as_of=date(2026, 3, 31))
    assert tb["balanced"] and all(r["debit_balance"] == r["credit_balance"] == 0 for r in tb["rows"])
    with pytest.raises(Conflict):
        ledger.reverse_entry(db, e.id, user_id=None)


def test_statements_tie_out(db):
    post(db, [ledger.debit("1100", 10000), ledger.credit("3100", 10000)])
    post(db, [ledger.debit("1200", 4000), ledger.credit("4100", 4000)])
    post(db, [ledger.debit("5100", 1500), ledger.credit("1300", 1500)])
    post(db, [ledger.debit("6100", 500), ledger.credit("1100", 500)])
    inc = reports.income_statement(db, branch_id=None, start=date(2026, 3, 1), end=date(2026, 3, 31))
    assert inc["gross_profit"] == Decimal("2500.00") and inc["net_income"] == Decimal("2000.00")
    bs = reports.balance_sheet(db, branch_id=None, as_of=date(2026, 3, 31))
    assert bs["balanced"]
    gl = reports.general_ledger(db, account_code="1100", branch_id=None, start=date(2026, 3, 1), end=date(2026, 3, 31))
    assert gl["closing_balance"] == Decimal("9500.00") and gl["lines"][-1]["balance"] == Decimal("9500.00")
