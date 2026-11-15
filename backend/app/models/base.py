from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column

Money = Numeric(18, 2)
Qty = Numeric(18, 4)

ZERO = Decimal("0")
CENT = Decimal("0.01")
QTY_STEP = Decimal("0.0001")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def money(value) -> Decimal:
    return Decimal(value).quantize(CENT)


def qty(value) -> Decimal:
    return Decimal(value).quantize(QTY_STEP)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
