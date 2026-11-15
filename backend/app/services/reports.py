"""Financial statements computed directly from the ledger (always real-time)."""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Account, Invoice, JournalEntry, JournalLine
from app.models.base import ZERO, money


def _balances(db: Session, *, branch_id: int | None, start: date | None, end: date | None, exclude_closing: bool = False):
    """Per-account debit/credit totals for a date window.

    Year-end closing entries are excluded from period profit reports so a closed year still shows its results.
    """
    conds = []
    if exclude_closing:
        conds.append(func.coalesce(JournalEntry.source_type, "") != "CLOSING")
    if branch_id:
        conds.append(JournalEntry.branch_id == branch_id)
    if start:
        conds.append(JournalEntry.entry_date >= start)
    if end:
        conds.append(JournalEntry.entry_date <= end)
    sub_q = (
        select(
            JournalLine.account_id.label("account_id"),
            func.sum(JournalLine.debit).label("d"),
            func.sum(JournalLine.credit).label("c"),
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .group_by(JournalLine.account_id)
    )
    if conds:
        sub_q = sub_q.where(*conds)
    sub = sub_q.subquery()
    q = (
        select(
            Account.id,
            Account.code,
            Account.name,
            Account.account_type,
            Account.report_group,
            Account.normal_balance,
            func.coalesce(sub.c.d, 0),
            func.coalesce(sub.c.c, 0),
        )
        .outerjoin(sub, sub.c.account_id == Account.id)
        .order_by(Account.code)
    )
    rows = []
    for id_, code, name, atype, group, normal, d, c in db.execute(q):
        d, c = money(d), money(c)
        rows.append(
            {
                "account_id": id_,
                "code": code,
                "name": name,
                "account_type": atype,
                "report_group": group,
                "normal_balance": normal,
                "debit": d,
                "credit": c,
                "balance": (d - c) if normal == "DEBIT" else (c - d),
            }
        )
    return rows


def trial_balance(db: Session, *, branch_id: int | None, as_of: date) -> dict:
    rows = [r for r in _balances(db, branch_id=branch_id, start=None, end=as_of) if r["debit"] or r["credit"]]
    for r in rows:
        net = r["debit"] - r["credit"]
        r["debit_balance"] = net if net > 0 else ZERO
        r["credit_balance"] = -net if net < 0 else ZERO
    td = sum((r["debit_balance"] for r in rows), ZERO)
    tc = sum((r["credit_balance"] for r in rows), ZERO)
    return {"as_of": as_of, "rows": rows, "total_debit": td, "total_credit": tc, "balanced": td == tc}


def general_ledger(
    db: Session, *, account_code: str, branch_id: int | None, start: date, end: date
) -> dict:
    account = db.execute(select(Account).where(Account.code == account_code)).scalar_one_or_none()
    if account is None:
        from app.core.errors import NotFound

        raise NotFound("Account not found")
    sign = 1 if account.normal_balance == "DEBIT" else -1

    base = select(
        func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0)
    ).join(JournalEntry, JournalEntry.id == JournalLine.entry_id).where(JournalLine.account_id == account.id)
    if branch_id:
        base = base.where(JournalEntry.branch_id == branch_id)
    opening = money(db.execute(base.where(JournalEntry.entry_date < start)).scalar_one()) * sign

    q = (
        select(JournalEntry, JournalLine)
        .join(JournalLine, JournalLine.entry_id == JournalEntry.id)
        .where(JournalLine.account_id == account.id, JournalEntry.entry_date >= start, JournalEntry.entry_date <= end)
        .order_by(JournalEntry.entry_date, JournalEntry.id, JournalLine.id)
    )
    if branch_id:
        q = q.where(JournalEntry.branch_id == branch_id)
    running = opening
    lines = []
    for entry, line in db.execute(q):
        running += (line.debit - line.credit) * sign
        lines.append(
            {
                "date": entry.entry_date,
                "entry_no": entry.entry_no,
                "description": entry.description,
                "memo": line.memo,
                "debit": line.debit,
                "credit": line.credit,
                "balance": running,
            }
        )
    return {
        "account": {"code": account.code, "name": account.name, "normal_balance": account.normal_balance},
        "start": start,
        "end": end,
        "opening_balance": opening,
        "closing_balance": running,
        "lines": lines,
    }


def income_statement(db: Session, *, branch_id: int | None, start: date, end: date) -> dict:
    rows = _balances(db, branch_id=branch_id, start=start, end=end, exclude_closing=True)

    def group(g: str):
        items = [r for r in rows if r["account_type"] in ("REVENUE", "EXPENSE") and r["report_group"] == g and r["balance"]]
        return items, sum((r["balance"] for r in items), ZERO)

    revenue, total_rev = group("REVENUE")
    cogs, total_cogs = group("COGS")
    opex, total_opex = group("OPEX")
    other, total_other = group("OTHER")
    gross = total_rev - total_cogs
    operating = gross - total_opex
    return {
        "start": start,
        "end": end,
        "revenue": {"rows": revenue, "total": total_rev},
        "cogs": {"rows": cogs, "total": total_cogs},
        "gross_profit": gross,
        "gross_margin_pct": (gross / total_rev * 100).quantize(Decimal("0.01")) if total_rev else ZERO,
        "operating_expenses": {"rows": opex, "total": total_opex},
        "operating_income": operating,
        "other_expenses": {"rows": other, "total": total_other},
        "net_income": operating - total_other,
    }


def balance_sheet(db: Session, *, branch_id: int | None, as_of: date) -> dict:
    rows = _balances(db, branch_id=branch_id, start=None, end=as_of)

    def section(t: str):
        items = [r for r in rows if r["account_type"] == t and r["balance"]]
        return items, sum((r["balance"] for r in items), ZERO)

    assets, ta = section("ASSET")
    liabilities, tl = section("LIABILITY")
    equity, te = section("EQUITY")
    earnings = sum((r["balance"] for r in rows if r["account_type"] == "REVENUE"), ZERO) - sum(
        (r["balance"] for r in rows if r["account_type"] == "EXPENSE"), ZERO
    )
    return {
        "as_of": as_of,
        "assets": {"rows": assets, "total": ta},
        "liabilities": {"rows": liabilities, "total": tl},
        "equity": {"rows": equity, "current_earnings": earnings, "total": te + earnings},
        "balanced": ta == tl + te + earnings,
    }


BUCKETS = ("not_due", "d0_30", "d31_60", "d61_90", "d90_plus")


def aging(db: Session, *, invoice_type: str, branch_id: int | None, as_of: date) -> dict:
    """Outstanding invoices bucketed by days past due date."""
    q = select(Invoice).where(
        Invoice.invoice_type == invoice_type,
        Invoice.status.in_(("OPEN", "PARTIALLY_PAID")),
        Invoice.invoice_date <= as_of,
    )
    if branch_id:
        q = q.where(Invoice.branch_id == branch_id)
    parties: dict[int, dict] = {}
    totals = {b: ZERO for b in BUCKETS}
    for inv in db.execute(q).scalars():
        outstanding = inv.outstanding
        if outstanding <= 0:
            continue
        late = (as_of - inv.due_date).days
        bucket = (
            "not_due" if late <= 0 else "d0_30" if late <= 30 else "d31_60" if late <= 60 else "d61_90" if late <= 90 else "d90_plus"
        )
        pid = inv.supplier_id if invoice_type == "AP" else inv.customer_id
        row = parties.setdefault(pid, {"party_id": pid, **{b: ZERO for b in BUCKETS}, "total": ZERO, "invoices": []})
        row[bucket] += outstanding
        row["total"] += outstanding
        row["invoices"].append(
            {"invoice_no": inv.invoice_no, "due_date": inv.due_date, "outstanding": outstanding, "days_past_due": max(late, 0)}
        )
        totals[bucket] += outstanding
    return {
        "as_of": as_of,
        "invoice_type": invoice_type,
        "rows": list(parties.values()),
        "totals": {**totals, "total": sum(totals.values(), ZERO)},
    }
