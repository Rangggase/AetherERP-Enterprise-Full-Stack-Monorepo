from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select

from app.core.deps import DB, Audit, require
from app.core.errors import Conflict, NotFound
from app.models import Account, FiscalPeriod, JournalEntry, User
from app.schemas.common import ORM, NonNegative
from app.services import closing, ledger, reports

router = APIRouter(prefix="/accounting", tags=["accounting"])
read = Depends(require("accounting.read"))


class AccountOut(ORM):
    id: int
    code: str
    name: str
    account_type: str
    normal_balance: str
    report_group: str | None
    is_active: bool


class PeriodOut(ORM):
    id: int
    code: str
    start_date: date
    end_date: date
    status: str


class LineIn(BaseModel):
    account_code: str
    debit: NonNegative = 0
    credit: NonNegative = 0
    memo: str | None = None


class JournalIn(BaseModel):
    entry_date: date
    branch_id: int
    description: str = Field(min_length=3, max_length=255)
    lines: list[LineIn] = Field(min_length=2)

    @model_validator(mode="after")
    def balanced(self):
        if sum(l.debit for l in self.lines) != sum(l.credit for l in self.lines):
            raise ValueError("Total debit must equal total credit")
        return self


Poster = Annotated[User, Depends(require("accounting.post"))]


def _journal(e: JournalEntry) -> dict:
    return {
        "id": e.id, "entry_no": e.entry_no, "entry_date": e.entry_date, "branch_id": e.branch_id,
        "description": e.description, "source_type": e.source_type, "status": e.status, "reverses_id": e.reverses_id,
        "total": sum(l.debit for l in e.lines),
        "lines": [{"account_code": l.account.code, "account_name": l.account.name, "debit": l.debit,
                   "credit": l.credit, "memo": l.memo} for l in e.lines],
    }


@router.get("/accounts", response_model=list[AccountOut], dependencies=[read])
def accounts(db: DB):
    return db.execute(select(Account).order_by(Account.code)).scalars().all()


@router.get("/periods", response_model=list[PeriodOut], dependencies=[read])
def periods(db: DB):
    return db.execute(select(FiscalPeriod).order_by(FiscalPeriod.start_date)).scalars().all()


@router.post("/periods/{period_id}/close", response_model=PeriodOut, dependencies=[Depends(require("accounting.close"))])
def close_period(period_id: int, db: DB, audit: Audit):
    p = closing.close_period(db, period_id)
    audit.log("PERIOD_CLOSED", "fiscal_period", p.id, before={"status": "OPEN"}, after={"status": "CLOSED"})
    db.commit()
    return p


@router.post("/periods/{period_id}/reopen", response_model=PeriodOut, dependencies=[Depends(require("accounting.close"))])
def reopen_period(period_id: int, db: DB, audit: Audit):
    p = closing.reopen_period(db, period_id)
    audit.log("PERIOD_OPENED", "fiscal_period", p.id, before={"status": "CLOSED"}, after={"status": "OPEN"})
    db.commit()
    return p


@router.post("/year-end/{year}/close", dependencies=[Depends(require("accounting.close"))])
def close_year(year: int, db: DB, audit: Audit, user: Annotated[User, Depends(require("accounting.close", "accounting.post"))]):
    result = closing.close_year(db, year, user_id=user.id)
    audit.log("YEAR_CLOSED", "fiscal_year", year, after={"entries": result["entries"], "net_income": str(result["net_income"])})
    db.commit()
    return result


@router.get("/journals", dependencies=[read])
def journals(db: DB, branch_id: int | None = None, start: date | None = None, end: date | None = None,
             source_type: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    stmt = select(JournalEntry)
    if branch_id:
        stmt = stmt.where(JournalEntry.branch_id == branch_id)
    if start:
        stmt = stmt.where(JournalEntry.entry_date >= start)
    if end:
        stmt = stmt.where(JournalEntry.entry_date <= end)
    if source_type:
        stmt = stmt.where(JournalEntry.source_type == source_type)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return {"items": [_journal(e) for e in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/journals", status_code=201)
def create_journal(body: JournalIn, db: DB, audit: Audit, user: Poster):
    entry = ledger.post_entry(
        db, entry_date=body.entry_date, branch_id=body.branch_id, description=body.description,
        lines=[ledger.Line(l.account_code, debit=l.debit, credit=l.credit, memo=l.memo) for l in body.lines],
        source_type="MANUAL", user_id=user.id,
    )
    audit.log("POST", "journal_entry", entry.id, after={"entry_no": entry.entry_no, "lines": len(entry.lines)})
    db.commit()
    return _journal(entry)


@router.post("/journals/{entry_id}/reverse", status_code=201)
def reverse_journal(entry_id: int, db: DB, audit: Audit, user: Poster, on: date | None = None):
    rev = ledger.reverse_entry(db, entry_id, user_id=user.id, on=on)
    audit.log("REVERSE", "journal_entry", entry_id, after={"reversal_no": rev.entry_no})
    db.commit()
    return _journal(rev)


@router.get("/reports/general-ledger", dependencies=[read])
def general_ledger(db: DB, account_code: str, start: date, end: date, branch_id: int | None = None):
    return reports.general_ledger(db, account_code=account_code, branch_id=branch_id, start=start, end=end)


@router.get("/reports/trial-balance", dependencies=[read])
def trial_balance(db: DB, as_of: date, branch_id: int | None = None):
    return reports.trial_balance(db, branch_id=branch_id, as_of=as_of)


@router.get("/reports/income-statement", dependencies=[read])
def income_statement(db: DB, start: date, end: date, branch_id: int | None = None):
    return reports.income_statement(db, branch_id=branch_id, start=start, end=end)


@router.get("/reports/balance-sheet", dependencies=[read])
def balance_sheet(db: DB, as_of: date, branch_id: int | None = None):
    return reports.balance_sheet(db, branch_id=branch_id, as_of=as_of)


@router.get("/reports/aging/{kind}", dependencies=[read])
def aging(kind: str, db: DB, as_of: date, branch_id: int | None = None):
    if kind.upper() not in ("AP", "AR"):
        raise NotFound("Aging kind must be AP or AR")
    return reports.aging(db, invoice_type=kind.upper(), branch_id=branch_id, as_of=as_of)
