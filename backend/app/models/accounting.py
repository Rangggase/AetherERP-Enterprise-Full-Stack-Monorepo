from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import Money, TimestampMixin, utcnow


class FiscalPeriod(Base):
    __tablename__ = "fiscal_periods"
    __table_args__ = (
        CheckConstraint("status IN ('OPEN','CLOSED')", name="status"),
        CheckConstraint("end_date >= start_date", name="range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(7), unique=True)  # YYYY-MM
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(10), default="OPEN")


class DocumentSequence(Base):
    """Gap-tolerant, concurrency-safe document counters (one row per prefix and year)."""

    __tablename__ = "document_sequences"

    prefix: Mapped[str] = mapped_column(String(8), primary_key=True)
    year: Mapped[int] = mapped_column(primary_key=True)
    last_value: Mapped[int] = mapped_column(default=0)


class Account(TimestampMixin, Base):
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        CheckConstraint("account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')", name="type"),
        CheckConstraint("normal_balance IN ('DEBIT','CREDIT')", name="normal"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    account_type: Mapped[str] = mapped_column(String(10), index=True)
    # Sub-classification used by the income statement: REVENUE, COGS, OPEX, OTHER
    report_group: Mapped[str | None] = mapped_column(String(12))
    normal_balance: Mapped[str] = mapped_column(String(6))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        CheckConstraint("status IN ('POSTED','REVERSED')", name="status"),
        Index("ix_journal_entries_source", "source_type", "source_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_no: Mapped[str] = mapped_column(String(24), unique=True)
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("fiscal_periods.id"), index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    description: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str | None] = mapped_column(String(30))
    source_id: Mapped[int | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(10), default="POSTED")
    reverses_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"), unique=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    lines: Mapped[list["JournalLine"]] = relationship(back_populates="entry", lazy="selectin", order_by="JournalLine.id")


class JournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="non_negative"),
        CheckConstraint("NOT (debit > 0 AND credit > 0)", name="one_side"),
        Index("ix_journal_lines_account_entry", "account_id", "entry_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="RESTRICT"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("chart_of_accounts.id"))
    debit: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    memo: Mapped[str | None] = mapped_column(String(255))

    entry: Mapped[JournalEntry] = relationship(back_populates="lines")
    account: Mapped[Account] = relationship(lazy="joined")
