"""Atomic double-entry ledger engine.

All posting happens inside the caller's transaction so that a business document and its
journal commit (or roll back) together.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, NotFound
from app.models import Account, FiscalPeriod, JournalEntry, JournalLine
from app.models.base import ZERO, money
from app.services.numbering import next_number


@dataclass(frozen=True)
class Line:
    account: str  # chart-of-accounts code
    debit: Decimal = ZERO
    credit: Decimal = ZERO
    memo: str | None = None


def debit(account: str, amount, memo: str | None = None) -> Line:
    return Line(account, debit=money(amount), memo=memo)


def credit(account: str, amount, memo: str | None = None) -> Line:
    return Line(account, credit=money(amount), memo=memo)


def period_for(db: Session, on: date) -> FiscalPeriod:
    period = db.execute(
        select(FiscalPeriod).where(FiscalPeriod.start_date <= on, FiscalPeriod.end_date >= on)
    ).scalar_one_or_none()
    if period is None:
        raise DomainError(f"No fiscal period covers {on.isoformat()}")
    if period.status != "OPEN":
        raise Conflict(f"Fiscal period {period.code} is closed")
    return period


def post_entry(
    db: Session,
    *,
    entry_date: date,
    branch_id: int,
    description: str,
    lines: list[Line],
    source_type: str | None = None,
    source_id: int | None = None,
    user_id: int | None = None,
    reverses_id: int | None = None,
) -> JournalEntry:
    lines = [l for l in lines if l.debit or l.credit]
    if len(lines) < 2:
        raise DomainError("A journal entry needs at least two non-zero lines")
    for l in lines:
        if l.debit < 0 or l.credit < 0:
            raise DomainError("Debit and credit must not be negative")
        if l.debit and l.credit:
            raise DomainError("A line cannot carry both a debit and a credit")
    total_debit = sum((l.debit for l in lines), ZERO)
    total_credit = sum((l.credit for l in lines), ZERO)
    if total_debit != total_credit:
        raise DomainError(f"Journal is unbalanced: debit {total_debit} != credit {total_credit}")

    period = period_for(db, entry_date)
    codes = {l.account for l in lines}
    accounts = {
        a.code: a for a in db.execute(select(Account).where(Account.code.in_(codes))).scalars()
    }
    missing = codes - accounts.keys()
    if missing:
        raise NotFound(f"Unknown account code(s): {', '.join(sorted(missing))}")
    inactive = [c for c, a in accounts.items() if not a.is_active]
    if inactive:
        raise DomainError(f"Inactive account(s): {', '.join(sorted(inactive))}")

    entry = JournalEntry(
        entry_no=next_number(db, "JE", entry_date),
        entry_date=entry_date,
        period_id=period.id,
        branch_id=branch_id,
        description=description,
        source_type=source_type,
        source_id=source_id,
        status="POSTED",
        reverses_id=reverses_id,
        created_by=user_id,
    )
    entry.lines = [
        JournalLine(account_id=accounts[l.account].id, debit=l.debit, credit=l.credit, memo=l.memo) for l in lines
    ]
    db.add(entry)
    db.flush()
    return entry


def reverse_entry(db: Session, entry_id: int, *, user_id: int | None, on: date | None = None) -> JournalEntry:
    original = db.get(JournalEntry, entry_id)
    if original is None:
        raise NotFound("Journal entry not found")
    if original.status == "REVERSED" or original.reverses_id is not None:
        raise Conflict("Entry is already reversed or is itself a reversal")
    mirrored = [
        Line(l.account.code, debit=l.credit, credit=l.debit, memo=l.memo) for l in original.lines
    ]
    reversal = post_entry(
        db,
        entry_date=on or date.today(),
        branch_id=original.branch_id,
        description=f"Reversal of {original.entry_no}: {original.description}",
        lines=mirrored,
        source_type="REVERSAL",
        source_id=original.id,
        user_id=user_id,
        reverses_id=original.id,
    )
    original.status = "REVERSED"
    db.flush()
    return reversal
