"""Fiscal period close, reopen and year-end closing entries."""
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, NotFound
from app.models import Account, Branch, FiscalPeriod, JournalEntry, JournalLine, StockCount
from app.models.base import ZERO, money
from app.services import ledger

RETAINED_EARNINGS = "3200"
CLOSING = "CLOSING"


def _period(db: Session, period_id: int) -> FiscalPeriod:
    p = db.get(FiscalPeriod, period_id)
    if p is None:
        raise NotFound("Period not found")
    return p


def year_closed(db: Session, year: int) -> bool:
    return db.execute(
        select(JournalEntry.id).where(
            JournalEntry.source_type == CLOSING, JournalEntry.entry_date >= date(year, 1, 1), JournalEntry.entry_date <= date(year, 12, 31)
        ).limit(1)
    ).first() is not None


def close_period(db: Session, period_id: int) -> FiscalPeriod:
    p = _period(db, period_id)
    if p.status == "CLOSED":
        raise Conflict("Period is already closed")
    earlier_open = db.execute(
        select(FiscalPeriod.code).where(FiscalPeriod.start_date < p.start_date, FiscalPeriod.status == "OPEN").order_by(FiscalPeriod.start_date).limit(1)
    ).scalar_one_or_none()
    if earlier_open:
        raise Conflict(f"Close {earlier_open} first: periods must be closed in order")
    drafts = db.execute(
        select(func.count()).select_from(StockCount).where(
            StockCount.status == "DRAFT", StockCount.count_date >= p.start_date, StockCount.count_date <= p.end_date
        )
    ).scalar_one()
    if drafts:
        raise Conflict(f"{drafts} stock count(s) dated in {p.code} are still drafts; post or remove them first")
    p.status = "CLOSED"
    db.flush()
    return p


def reopen_period(db: Session, period_id: int) -> FiscalPeriod:
    p = _period(db, period_id)
    if p.status == "OPEN":
        raise Conflict("Period is already open")
    if year_closed(db, p.start_date.year):
        raise Conflict(f"Year {p.start_date.year} has closing entries; reopening a period would make them stale")
    later_closed = db.execute(
        select(FiscalPeriod.code).where(FiscalPeriod.start_date > p.start_date, FiscalPeriod.status == "CLOSED").order_by(FiscalPeriod.start_date).limit(1)
    ).scalar_one_or_none()
    if later_closed:
        raise Conflict(f"Reopen {later_closed} first: periods must be reopened in reverse order")
    p.status = "OPEN"
    db.flush()
    return p


def close_year(db: Session, year: int, *, user_id: int | None) -> dict:
    """Zero the year's revenue and expense accounts into retained earnings, per branch, then close December."""
    periods = db.execute(select(FiscalPeriod).where(FiscalPeriod.start_date >= date(year, 1, 1), FiscalPeriod.end_date <= date(year, 12, 31)).order_by(FiscalPeriod.start_date)).scalars().all()
    if len(periods) != 12:
        raise DomainError(f"Fiscal periods for {year} are incomplete")
    if year_closed(db, year):
        raise Conflict(f"Year {year} is already closed")
    still_open = [p.code for p in periods[:-1] if p.status == "OPEN"]
    if still_open:
        raise Conflict(f"Close {still_open[0]} and every earlier period before closing the year")
    december = periods[-1]
    if december.status != "OPEN":
        raise Conflict("December must still be open to receive the closing entries")

    start, end = date(year, 1, 1), date(year, 12, 31)
    rows = db.execute(
        select(JournalEntry.branch_id, Account.code, Account.normal_balance, func.sum(JournalLine.debit), func.sum(JournalLine.credit))
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .join(Account, Account.id == JournalLine.account_id)
        .where(Account.account_type.in_(("REVENUE", "EXPENSE")), JournalEntry.entry_date >= start, JournalEntry.entry_date <= end)
        .group_by(JournalEntry.branch_id, Account.code, Account.normal_balance)
    ).all()
    by_branch: dict[int, list[tuple[str, Decimal]]] = {}
    for branch_id, code, _normal, d, c in rows:
        net = money(d) - money(c)  # debit-positive
        if net:
            by_branch.setdefault(branch_id, []).append((code, net))

    total_profit = ZERO
    entries = []
    for branch_id, items in by_branch.items():
        lines = []
        for code, net in items:
            # A debit-balance account (expense) is cleared with a credit, and vice versa.
            lines.append(ledger.credit(code, net) if net > 0 else ledger.debit(code, -net))
        profit = -sum((n for _, n in items), ZERO)  # credits minus debits
        # The clearing lines leave debits exceeding credits by `profit`, so profit goes to retained earnings as a credit.
        lines.append(ledger.credit(RETAINED_EARNINGS, profit) if profit > 0 else ledger.debit(RETAINED_EARNINGS, -profit))
        je = ledger.post_entry(db, entry_date=end, branch_id=branch_id, description=f"Year-end closing {year}", lines=lines,
                               source_type=CLOSING, user_id=user_id)
        entries.append(je.entry_no)
        total_profit += profit
    december.status = "CLOSED"
    db.flush()
    return {"year": year, "entries": entries, "net_income": total_profit}
