import calendar
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog, Category, Invoice, JournalEntry, JournalLine, Account, Product, SalesOrder, SalesOrderItem, StockBalance, User,
)
from app.models.base import ZERO, money
from app.services import inventory, reports


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _shift(d: date, months: int) -> date:
    idx = d.year * 12 + d.month - 1 + months
    return date(idx // 12, idx % 12 + 1, 1)


def latest_activity_date(db: Session) -> date:
    return db.execute(select(func.max(JournalEntry.entry_date))).scalar_one() or date.today()


def overview(db: Session, *, branch_id: int | None, as_of: date | None = None, months: int = 6) -> dict:
    as_of = as_of or latest_activity_date(db)
    m_start, m_end = _month_start(as_of), _month_end(as_of)
    cur = reports.income_statement(db, branch_id=branch_id, start=m_start, end=m_end)
    prev_start = _shift(m_start, -1)
    prev = reports.income_statement(db, branch_id=branch_id, start=prev_start, end=_month_end(prev_start))

    overdue = db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).where(
            Invoice.invoice_type == "AR", Invoice.status.in_(("OPEN", "PARTIALLY_PAID")), Invoice.due_date < as_of,
            *([Invoice.branch_id == branch_id] if branch_id else []),
        )
    ).scalar_one()
    ar_total = db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).where(
            Invoice.invoice_type == "AR", Invoice.status.in_(("OPEN", "PARTIALLY_PAID")),
            *([Invoice.branch_id == branch_id] if branch_id else []),
        )
    ).scalar_one()

    low_q = (
        select(func.count()).select_from(StockBalance).join(Product, Product.id == StockBalance.product_id)
        .where(Product.reorder_point > 0, (StockBalance.on_hand - StockBalance.reserved) <= Product.reorder_point,
               *([StockBalance.branch_id == branch_id] if branch_id else []))
    )
    cash = reports.trial_balance(db, branch_id=branch_id, as_of=as_of)
    cash_balance = next((r["balance"] for r in cash["rows"] if r["code"] == "1100"), ZERO)

    trend = []
    for k in range(months - 1, -1, -1):
        s = _shift(m_start, -k)
        e = _month_end(s)
        inc = reports.income_statement(db, branch_id=branch_id, start=s, end=e)
        flow = db.execute(
            select(func.coalesce(func.sum(JournalLine.debit), 0), func.coalesce(func.sum(JournalLine.credit), 0))
            .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
            .join(Account, Account.id == JournalLine.account_id)
            .where(Account.code == "1100", JournalEntry.entry_date >= s, JournalEntry.entry_date <= e,
                   # Capital injections are financing, not operating cash flow.
                   func.coalesce(JournalEntry.source_type, "") != "OPENING",
                   *([JournalEntry.branch_id == branch_id] if branch_id else []))
        ).one()
        trend.append({
            "month": s.strftime("%Y-%m"), "revenue": inc["revenue"]["total"], "cogs": inc["cogs"]["total"],
            "gross_profit": inc["gross_profit"], "cash_in": money(flow[0]), "cash_out": money(flow[1]),
            "net_cash": money(flow[0]) - money(flow[1]),
        })

    by_cat = db.execute(
        select(Category.name, func.coalesce(func.sum(SalesOrderItem.quantity * SalesOrderItem.unit_price), 0))
        .select_from(SalesOrderItem)
        .join(SalesOrder, SalesOrder.id == SalesOrderItem.so_id)
        .join(Product, Product.id == SalesOrderItem.product_id)
        .outerjoin(Category, Category.id == Product.category_id)
        .where(SalesOrder.status.in_(("DELIVERED", "INVOICED", "PARTIALLY_PAID", "PAID")),
               SalesOrder.order_date >= _shift(m_start, -(months - 1)), SalesOrder.order_date <= m_end,
               *([SalesOrder.branch_id == branch_id] if branch_id else []))
        .group_by(Category.name).order_by(func.sum(SalesOrderItem.quantity * SalesOrderItem.unit_price).desc())
    ).all()

    recent = db.execute(
        select(AuditLog, User.full_name).outerjoin(User, User.id == AuditLog.user_id)
        .where(AuditLog.action.notin_(("LOGIN", "LOGIN_FAILED"))).order_by(AuditLog.id.desc()).limit(12)
    ).all()

    def delta(a: Decimal, b: Decimal):
        return float(((a - b) / b * 100).quantize(Decimal("0.1"))) if b else None

    return {
        "as_of": as_of, "branch_id": branch_id,
        "kpis": {
            "net_revenue": cur["revenue"]["total"], "net_revenue_change_pct": delta(cur["revenue"]["total"], prev["revenue"]["total"]),
            "gross_margin_pct": cur["gross_margin_pct"], "prev_gross_margin_pct": prev["gross_margin_pct"],
            "net_income": cur["net_income"],
            "inventory_value": inventory.stock_value(db, branch_id),
            "overdue_receivables": money(overdue), "total_receivables": money(ar_total),
            "low_stock_count": db.execute(low_q).scalar_one(), "cash_balance": cash_balance,
        },
        "trend": trend,
        "sales_by_category": [{"category": n or "Uncategorised", "amount": money(v)} for n, v in by_cat],
        "recent_activity": [
            {"id": a.id, "action": a.action, "entity_type": a.entity_type, "entity_id": a.entity_id,
             "user": name or "System", "created_at": a.created_at} for a, name in recent
        ],
    }
