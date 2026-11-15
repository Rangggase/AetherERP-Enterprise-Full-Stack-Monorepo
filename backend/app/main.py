import warnings
from decimal import Decimal

from fastapi import FastAPI, Request, encoders
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.ratelimit import RateLimitMiddleware
from app.models.guards import ImmutableRecordError
from app.routers import accounting, auth, inventory, master, procurement, sales, system

# SQLite stores NUMERIC as binary floating point; values are re-quantised to 2/4 dp on read.
warnings.filterwarnings("ignore", message="Dialect sqlite\\+pysqlite does not support Decimal")

# Serialise Decimals as exact strings in hand-built dict responses, matching Pydantic's behaviour
# for typed models; clients must never receive money as binary floats.
encoders.ENCODERS_BY_TYPE[Decimal] = lambda d: format(d, "f")

app = FastAPI(title="AetherERP API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error(_: Request, exc: DomainError):
    return JSONResponse({"detail": exc.message}, status_code=exc.status_code)


@app.exception_handler(ImmutableRecordError)
async def immutable_error(_: Request, exc: ImmutableRecordError):
    return JSONResponse({"detail": str(exc)}, status_code=409)


@app.exception_handler(IntegrityError)
async def integrity_error(_: Request, exc: IntegrityError):
    return JSONResponse({"detail": "The change violates a data integrity rule"}, status_code=409)


@app.get("/api/health")
def health():
    return {"status": "ok"}


for r in (auth.router, master.router, accounting.router, procurement.router, inventory.router,
          sales.router, sales.inv_router, system.router):
    app.include_router(r, prefix="/api/v1")
