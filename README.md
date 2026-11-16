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
cp .env.example .env          # Windows cmd: copy .env.example .env. Set SECRET_KEY.
python -m app.cli seed        # create the schema, reference data and demo data
uvicorn app.main:app --reload
```

`app.cli` commands:

| Command | Effect |
| --- | --- |
| `init` | Create missing tables and reference data (roles, permissions, chart of accounts, branches, fiscal periods) |
| `seed` | `init` plus demo data; does nothing to the demo data if products already exist |
| `reset` | **Drops every table**, then runs `seed`. Use only to start over |
| `createadmin EMAIL PASSWORD` | Create an administrator on an empty system |

The CLI builds the schema directly from the models. Databases for real use should be created and upgraded with Alembic (`alembic upgrade head`), as described in [docs/deployment.md](docs/deployment.md); a database created by the CLI has no Alembic version recorded and cannot be upgraded that way.

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

## Sales return rules

A sales return is a credit note recorded against an invoiced order.

- The order must be invoiced and not fully paid (`INVOICED` or `PARTIALLY_PAID`).
- The credit cannot exceed the invoice's outstanding balance.
- Refunding an invoice that has already been paid is rejected; refunds are not supported.
- A product cannot be returned in a larger quantity than was sold and not yet returned.
- Returned stock re-enters as a new FIFO layer at the weighted-average cost of the layers consumed by the delivery.
- Posting: debit 4150 Sales returns and credit 1200 Accounts receivable for the credit; debit inventory and credit 5100 COGS for the restocked cost.

## Sprint summary

| Sprint | Delivered |
| --- | --- |
| 0 | Monorepo, schema, JWT authentication, RBAC, audit log |
| 1 | Double-entry ledger engine and financial reports |
| 2 | Procure-to-pay with goods receipts, vendor bills and supplier payments |
| 3 | FIFO inventory, inter-branch transfers, BOM assembly, stock opname, reorder advice |
| 4 | Order-to-cash with credit-limit guard and stock reservation |
| 5 | Application shell, executive dashboard, data tables, reports UI |
| 6 | Master data screens and CSV export (scope chosen by the developer; the brief defined Sprints 0-5 only) |
| 7 | Ordered period close, year-end closing entries, write locking, CI (scope chosen by the developer) |
| 8 | User administration, password policy, printable invoices (scope chosen by the developer) |
| 9 | Sales returns and the contra-revenue account 4150 (scope chosen by the developer) |

## Tests

```bash
cd backend && pytest
cd frontend && npm run typecheck
```

The backend suite has 44 tests. They cover ledger invariants, immutability, period locking and year-end closing, FIFO costing, transfers, assembly, opname, credit limits, overselling (including a concurrent race), sales returns, user administration, JWT rotation and RBAC. One test asserts that the GL inventory accounts always equal the value of the remaining FIFO layers.

## Documentation

See [docs/](docs): architecture and ERD, API contract, business case, deployment guide.
