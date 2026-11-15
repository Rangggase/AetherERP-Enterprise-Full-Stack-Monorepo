# AetherERP

Integrated multi-branch ERP covering procurement, warehouse and assembly (BOM), sales and CRM, and double-entry accounting. It is a full-stack monorepo built as an Information Systems portfolio project.

| Area | Stack |
| --- | --- |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, JWT with refresh rotation, RBAC, rate limiting |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS, TanStack Query and Table, Recharts |
| Database | SQLite by default (`backend/data/aether_erp.db`, opens directly in DBeaver); PostgreSQL-ready |

## What it does

- **Ledger engine**: every posting is validated inside one transaction (balanced, at least two lines, open fiscal period). Posted entries are immutable; corrections are reversing entries.
- **Reports** computed live, per branch or consolidated: general ledger with running balance, trial balance, income statement, balance sheet, AR/AP aging.
- **Procure-to-pay**: `DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_RECEIVED/RECEIVED → BILLED → PAID`. Large orders need a second person's approval. Goods receipts create FIFO layers and journal `Inventory / Goods received not billed`.
- **Warehouse**: multi-branch stock, FIFO costing, inter-branch transfers that carry cost layers, BOM assembly with actual-cost unit pricing, stock opname with shrinkage/gain journals, reorder advice from 30-day consumption.
- **Order-to-cash**: quotation, confirmation (credit-limit guard and stock reservation), delivery (COGS by FIFO), invoice, payments, and sales returns that credit the invoice and restock at the original cost. Reservations use guarded single-statement updates, so concurrent checkouts cannot oversell.
- **Period control and administration**: ordered month close, year-end closing entries, user and role administration, printable invoices, CSV export.
- **Security**: Argon2 password hashing, short-lived access tokens, rotating refresh tokens with reuse detection, 16 granular permissions across 7 roles, an append-only audit log with before/after JSON and IP.

## Quick start

Backend (from `backend/`):

```bash
python -m venv .venv
.venv/Scripts/activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set SECRET_KEY
python -m app.cli reset       # create schema and load demo data
uvicorn app.main:app --reload
```

API docs: <http://localhost:8000/api/docs>.

Frontend (from `frontend/`):

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Demo accounts (local demo data only) all use the password `Aether#Demo2026`:

| Email | Role |
| --- | --- |
| admin@aether.local | Admin |
| finance@aether.local | Finance Manager |
| procurement@aether.local | Procurement Manager |
| buyer@aether.local | Procurement Staff |
| warehouse@aether.local | Warehouse Staff |
| sales@aether.local | Sales Staff |
| auditor@aether.local | Auditor |

## Tests

```bash
cd backend && pytest
cd frontend && npm run typecheck
```

The suite covers ledger invariants, immutability, period locking, FIFO costing, transfers, assembly, opname, credit limits, overselling, JWT rotation and RBAC. One test asserts that the GL inventory accounts always equal the value of the remaining FIFO layers.

## Documentation

See [docs/](docs): architecture and ERD, API contract, business case, deployment guide.
