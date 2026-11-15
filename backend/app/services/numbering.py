from datetime import date

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import DocumentSequence


def next_number(db: Session, prefix: str, on: date | None = None) -> str:
    """Atomically allocate the next document number, e.g. PO-2026-000012."""
    year = (on or date.today()).year
    # Ensure the row exists, then increment it with a single UPDATE so concurrent
    # transactions serialise on the row lock instead of reading the same value.
    if db.get(DocumentSequence, (prefix, year)) is None:
        db.add(DocumentSequence(prefix=prefix, year=year, last_value=0))
        db.flush()
    db.execute(
        update(DocumentSequence)
        .where(DocumentSequence.prefix == prefix, DocumentSequence.year == year)
        .values(last_value=DocumentSequence.last_value + 1)
    )
    value = db.execute(
        select(DocumentSequence.last_value).where(DocumentSequence.prefix == prefix, DocumentSequence.year == year)
    ).scalar_one()
    return f"{prefix}-{year}-{value:06d}"
