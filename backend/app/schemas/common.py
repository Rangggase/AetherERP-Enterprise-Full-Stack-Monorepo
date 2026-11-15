from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")
Positive = Annotated[Decimal, Field(gt=0)]
NonNegative = Annotated[Decimal, Field(ge=0)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def snapshot(obj, *fields: str) -> dict:
    """Plain-JSON copy of selected attributes, for audit before/after payloads."""
    out = {}
    for f in fields:
        v = getattr(obj, f)
        out[f] = str(v) if isinstance(v, (Decimal, date, datetime)) else v
    return out
