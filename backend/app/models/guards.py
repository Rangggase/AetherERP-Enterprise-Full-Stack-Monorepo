"""ORM-level immutability guards for append-only and posted-ledger tables."""
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.accounting import JournalEntry, JournalLine
from app.models.inventory import StockMovement
from app.models.org import AuditLog

APPEND_ONLY = (AuditLog, StockMovement, JournalLine)


class ImmutableRecordError(Exception):
    pass


@event.listens_for(Session, "before_flush")
def _protect(session: Session, _ctx, _instances) -> None:
    for obj in session.deleted:
        if isinstance(obj, APPEND_ONLY + (JournalEntry,)):
            raise ImmutableRecordError(f"{type(obj).__name__} records cannot be deleted")
    for obj in session.dirty:
        if isinstance(obj, APPEND_ONLY) and session.is_modified(obj, include_collections=False):
            raise ImmutableRecordError(f"{type(obj).__name__} records are append-only")
        if isinstance(obj, JournalEntry):
            state = session.is_modified(obj, include_collections=False)
            if state:
                # The only permitted change on a posted entry is POSTED -> REVERSED.
                from sqlalchemy import inspect

                changed = {a.key for a in inspect(obj).attrs if a.history.has_changes()}
                if changed - {"status"}:
                    raise ImmutableRecordError("Posted journal entries are immutable; post a reversing entry instead")
