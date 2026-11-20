<div align="center">

# AetherERP

**A multi-branch ERP for a distributor and light assembler: procurement, FIFO inventory, assembly, sales and double-entry accounting in one full-stack monorepo.**

[![CI](https://github.com/Rangggase/AetherERP-Enterprise-Full-Stack-Monorepo/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Rangggase/AetherERP-Enterprise-Full-Stack-Monorepo/actions/workflows/ci.yml)
![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![SQLite or PostgreSQL](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-4169E1?logo=postgresql&logoColor=white)

</div>

![AetherERP dashboard for the administrator role](docs/screenshots/v3-dasbor-1440.png)

AetherERP is built around *Nusantara Smart Devices*, a fictional distributor and light assembler of consumer electronics. The company has a head office in Jakarta and warehouses in Surabaya and Bandung, and the demo data covers six months of its trade. Every business document posts its journal entry in the same database transaction, so stock, receivables and payables always agree with the general ledger. The project was built as an Information Systems portfolio piece.

> [!NOTE]
> The user interface is in Indonesian and amounts are shown in Indonesian rupiah (IDR). Code, API and most documentation are in English.

## Contents

- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Roles and permissions](#roles-and-permissions)
- [Business rules](#business-rules)
- [API](#api)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Project history](#project-history)
- [Known limitations](#known-limitations)
- [License](#license)

## Highlights

### Business modules

- **Ledger engine.** Each posting is validated inside one transaction. It must balance, have at least two lines and fall in an open fiscal period. Posted entries are immutable, and corrections are made with reversing entries.
- **Financial reports.** These are computed live, per branch or consolidated: general ledger with running balance, trial balance, income statement, balance sheet, and AR/AP aging.
- **Procure-to-pay.** Orders move through `DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_RECEIVED / RECEIVED → BILLED → PAID`. Orders above the approval threshold need a second person to approve them. Goods receipts create FIFO cost layers and post *Inventory / Goods received not billed*.
- **Inventory and assembly.** Stock is tracked per branch with FIFO costing. Inter-branch transfers carry their cost layers, bill-of-materials assembly is valued at actual cost, and stock counts (opname) post shrinkage and gain journals. Reorder advice is based on 30-day consumption.
- **Order-to-cash.** The flow covers quotation, confirmation with a credit-limit check and stock reservation, delivery (COGS by FIFO), invoicing, payments, and sales returns that credit the invoice and restock at the original cost. Reservations use guarded single-statement updates, so concurrent orders cannot oversell.
- **Period control.** Months close in order, year-end closing entries are generated, and closed periods reject postings.
- **Administration and audit.** The system includes user and role management, a password policy, printable invoices, CSV export, and an append-only audit log that stores before/after JSON and the client IP.
- **Security.** Passwords are hashed with Argon2. Access tokens are short-lived, and refresh tokens rotate with reuse detection. Access is controlled by 16 permissions across 7 roles, with per-IP rate limits and hardened response headers.

### User interface

- **Role-aware dashboards.** Executives, finance, procurement, warehouse, sales and auditors each get a dashboard with the figures and tasks for their role.
- **Document workspace.** Clicking a list row opens a preview drawer; clicking the document number opens the full document. A *document chain* links each order, invoice, payment and return using the IDs returned by the API, never by guessing from text.
- **Accounting made visible.** Journals are drawn as balanced debit and credit threads, and the general ledger can also be viewed as T-accounts. Stock levels appear as an isometric map grouped by branch and category.
- **Fast navigation.** The header holds a command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>), a branch filter and a stamp showing the open fiscal period.
- **Accessibility.** Text and interface colours pass WCAG AA in 301 automated checks, and the core flows are tested with the keyboard only. Motion follows the operating system preference or a per-browser setting: Full, Reduced or Minimal. Layouts are checked at 200% zoom, in forced-colours mode and at phone width.
- **Small footprint.** The app uses no chart or animation library. Charts are plain SVG, motion runs on the Web Animations API and CSS, and fonts are self-hosted. The initial dashboard load is about 102 kB of gzipped JavaScript. Invoices and reports have their own print layouts.

## Screenshots

| Invoice with its document chain | Sales return |
| --- | --- |
| ![Invoice detail with the document chain and payment stamp](docs/screenshots/v3-faktur-detail-1440.png) | ![Sales return form with credit summary](docs/screenshots/v3-retur-form-1440.png) |
| **Stock levels by branch and category** | **Trial balance** |
| ![Stock levels drawn as an isometric map](docs/screenshots/v3-level-stok-1440.png) | ![Financial reports showing a balanced trial balance](docs/screenshots/v3-laporan-1440.png) |

<p align="center">
  <img src="docs/storyboard/m1-jejak-tinta/bingkai-6-1100ms.png" alt="A sales return journal drawn as debit and credit threads that meet in balance" width="760">
  <br>
  <sub>Journal view: debit and credit lines are drawn as threads that meet in balance. This storyboard frame uses sample data.</sub>
</p>

[`docs/screenshots`](docs/screenshots) has the remaining screens, including phone layouts and the dashboard for each role.

## Architecture

```mermaid
flowchart LR
    UI["React SPA<br/>Vite · TanStack Query"] -- "JSON over /api/v1 (JWT)" --> R
    subgraph BE["FastAPI backend"]
        R["Routers<br/>auth · RBAC · validation · audit log"] --> S["Services<br/>ledger · inventory · procurement<br/>sales · reports · closing"]
        S --> M["SQLAlchemy 2.0 models<br/>38 tables · constraints · append-only guards"]
    end
    M --> DB[("SQLite (default)<br/>or PostgreSQL")]
```

- **Routers** authenticate and authorise the request, validate it with Pydantic, call a service, write the audit row and commit.
- **Services** hold the business rules and only flush, so a document and its journal entry are committed or rolled back together.
- **Money** is stored as `Numeric(18,2)`, and quantities and unit costs as `Numeric(18,4)`. The API returns decimals as strings, never as floats.
- **Append-only records.** ORM guards prevent edits and deletes on journal lines, stock movements and audit logs.
- **Document numbers** such as `PO-2026-000012` come from a concurrency-safe sequence table.

[docs/architecture.md](docs/architecture.md) covers the layer rules, concurrency handling, posting rules and the ERD.

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.11+, FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, Pydantic v2 with pydantic-settings, PyJWT, Argon2 via pwdlib |
| Database | SQLite by default (`backend/data/aether_erp.db`); PostgreSQL through psycopg 3 |
| Frontend | React 18, TypeScript (strict), Vite 5, React Router 6, TanStack Query 5, TanStack Table 8, Tailwind CSS 3, design tokens as CSS custom properties |
| Typography | IBM Plex Sans, IBM Plex Mono and Source Serif 4, all self-hosted |
| Quality | pytest with httpx, Alembic migration drift check, TypeScript type-check, WCAG contrast script, Playwright end-to-end scripts, GitHub Actions |

## Getting started

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer (CI uses Node 22)

### 1. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env, then set SECRET_KEY
python -m app.cli seed           # schema, reference data and six months of demo data
uvicorn app.main:app --reload
```

The API listens on <http://localhost:8000>, and the interactive docs are at <http://localhost:8000/api/docs>.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The dev server forwards `/api` to `http://127.0.0.1:8000`; set `VITE_API_TARGET` to point it at another backend.

### Demo accounts

These accounts exist only in the local demo data. They all use the password `Aether#Demo2026`.

| Email | Role | Main tasks |
| --- | --- | --- |
| `admin@aether.local` | Admin | All modules, users and the audit log |
| `finance@aether.local` | Finance Manager | Journals, payments, period and year-end close |
| `procurement@aether.local` | Procurement Manager | Purchase order approval, receipts, stock operations |
| `buyer@aether.local` | Procurement Staff | Purchase orders, goods receipts, vendor bills |
| `warehouse@aether.local` | Warehouse Staff | Transfers, assembly, stock counts |
| `sales@aether.local` | Sales Staff | Quotations and sales orders |
| `auditor@aether.local` | Auditor | Read-only access plus the audit log |

### Backend CLI

Run these from `backend/` as `python -m app.cli <command>`.

| Command | Effect |
| --- | --- |
| `init` | Creates missing tables and reference data (roles, permissions, chart of accounts, branches, fiscal periods) |
| `seed` | Runs `init` and loads the demo data; leaves existing demo data alone if products already exist |
| `reset` | **Drops every table**, then runs `seed`. Use it only to start over |
| `createadmin EMAIL PASSWORD` | Creates an administrator on an empty system |

The CLI builds the schema directly from the models. For real use, create and upgrade the database with Alembic (`alembic upgrade head`) as described in [docs/deployment.md](docs/deployment.md). A database created by the CLI has no Alembic version recorded and cannot be upgraded that way.

## Configuration

The backend reads its settings from environment variables or `backend/.env` (see [`backend/.env.example`](backend/.env.example)).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./data/aether_erp.db` | SQLAlchemy URL. For PostgreSQL use `postgresql+psycopg://user:pass@host:5432/aether_erp` |
| `SECRET_KEY` | development value | Signs JWTs. Use a long random string; with a non-SQLite database the API refuses to start on a weak key |
| `ACCESS_TOKEN_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_DAYS` | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins |
| `RATE_LIMIT_PER_MINUTE` | `120` | Requests per minute per IP |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | `10` | Login attempts per minute per IP |
| `PO_APPROVAL_THRESHOLD` | `50000000` | Purchase orders above this amount (IDR) need approval |
| `VITE_API_TARGET` (frontend) | `http://127.0.0.1:8000` | Where the Vite dev and preview servers forward `/api` |

## Roles and permissions

Access is checked by the API on every request. The interface hides any action whose permissions the user does not hold.

| Role | Permissions |
| --- | --- |
| Admin | All 16 permissions |
| Finance Manager | Read access, `accounting.post`, `accounting.close`, `payments.write`, `master.write` |
| Procurement Manager | Read access, `procurement.write`, `procurement.approve`, `inventory.write` |
| Procurement Staff | Read access, `procurement.write` |
| Warehouse Staff | Read access, `inventory.write` |
| Sales Staff | Read access, `sales.write` |
| Auditor | Read access, `audit.read` |

*Read access* means `dashboard.read`, `master.read`, `accounting.read`, `procurement.read`, `inventory.read` and `sales.read`.

Some actions need two permissions. Delivering an order and recording a sales return require both `sales.write` and `inventory.write`. Closing a fiscal year requires both `accounting.close` and `accounting.post`. In the demo data, only Admin can deliver orders or record returns.

<details>
<summary>All 16 permissions</summary>

| Permission | Allows |
| --- | --- |
| `dashboard.read` | View dashboards |
| `master.read` | View master data |
| `master.write` | Manage master data |
| `accounting.read` | View the ledger and financial reports |
| `accounting.post` | Post and reverse journal entries |
| `accounting.close` | Open and close fiscal periods |
| `procurement.read` | View procurement documents |
| `procurement.write` | Create purchase orders, receipts and bills |
| `procurement.approve` | Approve purchase orders |
| `inventory.read` | View stock |
| `inventory.write` | Transfers, assembly and stock counts |
| `sales.read` | View sales documents |
| `sales.write` | Create and process sales orders |
| `payments.write` | Record customer and supplier payments |
| `users.manage` | Manage users and roles |
| `audit.read` | View the audit log |

</details>

## Business rules

### Posting rules

| Event | Debit | Credit |
| --- | --- | --- |
| Goods receipt | 1300 / 1310 Inventory | 2200 Goods received not billed |
| Vendor bill | 2200 Goods received not billed | 2100 Accounts payable |
| Supplier payment | 2100 Accounts payable | 1100 Cash and bank |
| Assembly completed | 1300 Finished goods | 1310 Raw materials (actual FIFO cost) |
| Delivery | 5100 Cost of goods sold | 1300 / 1310 Inventory |
| Customer invoice | 1200 Accounts receivable | 4100 Sales revenue |
| Customer payment | 1100 Cash and bank | 1200 Accounts receivable |
| Sales return | 4150 Sales returns (contra revenue) | 1200 Accounts receivable |
| Return restock | Inventory | 5100 Cost of goods sold |
| Stock shortage | 6900 Inventory loss | Inventory |
| Stock overage | Inventory | 4200 Inventory gain |

### Sales returns

A sales return is a credit note recorded against an invoiced order.

- The order must be invoiced and not fully paid (`INVOICED` or `PARTIALLY_PAID`).
- The credit cannot exceed the invoice's outstanding balance.
- Refunds for invoices that are already paid are not supported and are rejected.
- A product cannot be returned in a larger quantity than was sold and not yet returned.
- Returned stock re-enters as a new FIFO layer at the weighted-average cost of the layers the delivery consumed.

## API

- **Base path:** `/api/v1`. The interactive OpenAPI docs are at `/api/docs`, the schema is at `/api/openapi.json`, and `/api/health` is the health check.
- **Modules:** `/auth`, `/master`, `/accounting`, `/procurement`, `/inventory`, `/sales`, `/invoices`, plus the dashboard and system endpoints.
- **Authentication:**
  1. `POST /api/v1/auth/login` returns an access token and a refresh token.
  2. Send the access token as `Authorization: Bearer <token>`.
  3. `POST /api/v1/auth/refresh` rotates the refresh token. Replaying an old refresh token revokes its whole token family.
- **Errors** use the shape `{"detail": "..."}`. Integrity violations and attempts to change immutable records return `409`.
- **Money** is serialised as decimal strings such as `"15625000.00"`.

The endpoint contract and the permission each endpoint requires are in [docs/api.md](docs/api.md).

## Testing

```bash
# Backend: 44 tests on an in-memory SQLite database
cd backend
pytest -q

# Frontend: type-check, production build and colour-contrast check
cd frontend
npm run typecheck
npm run build
npm run contrast
```

The backend suite covers:

- ledger invariants, immutability, period locking and year-end closing
- FIFO costing, transfers, assembly and stock counts
- credit limits, and overselling, including a race between concurrent requests
- sales returns, user administration, JWT rotation and RBAC

One test asserts that the inventory accounts in the general ledger always equal the value of the remaining FIFO layers.

`npm run contrast` checks every text and interface colour pair in the design tokens against WCAG AA, in every paper tone and with and without texture.

**End-to-end scripts.** [`frontend/tests/e2e`](frontend/tests/e2e) holds Playwright scripts covering:

- menus, dashboards and actions for each role, including API rejection of requests without permission
- the complete sales-return flow, with the screen totals compared against the API response
- keyboard-only use and the motion modes
- page transitions and their fallback
- period close and reopen
- a check that pages run no animations while idle

> [!WARNING]
> The scripts create documents through the API. Run them only against a disposable copy of the database, never against data you want to keep.

To run them, first start a backend whose `DATABASE_URL` points at a copy of the database, then a frontend whose `VITE_API_TARGET` points at that backend. Then run:

```bash
cd frontend
PW_PATH=<path to the playwright package> BASE=http://127.0.0.1:5180 node tests/e2e/run.cjs
```

**Continuous integration.** [GitHub Actions](.github/workflows/ci.yml) runs on every push to `main` and on every pull request. It runs the backend tests, checks that the Alembic migrations match the models, and builds the frontend.

## Project structure

```text
AetherERP/
├── backend/
│   ├── app/
│   │   ├── core/          settings, database, auth dependencies, rate limiting, security headers
│   │   ├── models/        SQLAlchemy models and append-only guards
│   │   ├── routers/       FastAPI routers mounted under /api/v1
│   │   ├── schemas/       Pydantic request and response models
│   │   ├── services/      business rules: ledger, inventory, procurement, sales, reports, closing
│   │   ├── cli.py         init, seed, reset, createadmin
│   │   └── seed.py        roles, permissions, chart of accounts, branches, demo data
│   ├── migrations/        Alembic migrations
│   └── tests/             pytest suite
├── frontend/
│   ├── public/fonts/      self-hosted fonts
│   ├── scripts/           WCAG contrast checker
│   ├── src/
│   │   ├── components/    app shell, data table, forms, command palette, signature components
│   │   ├── config/        feature switches
│   │   ├── design/        design tokens and font faces
│   │   ├── lib/           API client, session, permissions, navigation, formatting
│   │   ├── motion/        motion tokens, motion levels, springs, view transitions
│   │   ├── pages/         route screens
│   │   └── styles/        route-level stylesheets
│   └── tests/e2e/         Playwright scripts
├── docs/                  architecture, API, deployment, design system, screenshots, storyboards
├── motion-audits/         motion design review report
└── .github/workflows/     CI pipeline
```

## Documentation

| Document | Contents |
| --- | --- |
| [Architecture](docs/architecture.md) | Layers, key design decisions, concurrency, posting rules, ERD |
| [API contract](docs/api.md) | Endpoints grouped by module, with the permission each requires |
| [Deployment](docs/deployment.md) | Environment, PostgreSQL setup, production run, release checklist |
| [Business case](docs/business-case.md) | The fictional company, the problems the system solves, a demo walkthrough |
| [Design system](docs/design-system.md) | Tokens, typography, motion, components, accessibility and performance budgets (Indonesian) |
| [Storyboards](docs/storyboard/README.md) | Key frames and recordings of the signature interactions (Indonesian) |
| [UI v3 progress log](docs/progress-ui-v3.md) | Decisions, data map and verification results of the latest UI iteration (Indonesian) |

## Project history

| Stage | Delivered |
| --- | --- |
| Sprint 0 | Monorepo, schema, JWT authentication, RBAC, audit log |
| Sprint 1 | Double-entry ledger engine and financial reports |
| Sprint 2 | Procure-to-pay with goods receipts, vendor bills and supplier payments |
| Sprint 3 | FIFO inventory, inter-branch transfers, BOM assembly, stock counts, reorder advice |
| Sprint 4 | Order-to-cash with credit-limit check and stock reservation |
| Sprint 5 | Application shell, executive dashboard, data tables, reports UI |
| Sprint 6 | Master data screens and CSV export |
| Sprint 7 | Ordered period close, year-end closing entries, write locking, CI |
| Sprint 8 | User administration, password policy, printable invoices |
| Sprint 9 | Sales returns and the contra-revenue account 4150 |
| UI v2 | "Accountant's desk" visual language: depth tokens, custom glyphs, tactile controls, rail sidebar and mobile tab bar, ledger tables, SVG charts, route permission guard |
| UI v3 | "Living Ledger": design tokens and self-hosted fonts, motion system with user preferences, signature interactions (journal threads, document chain, T-accounts, stock map, period close), role-based dashboards, accessibility and performance budgets |

The original brief defined Sprints 0–5. The developer chose the scope of Sprints 6–9 and of both UI iterations.

## Known limitations

- **No FIFO layer endpoint.** The API does not expose individual FIFO layers or a goods-flow report, so the interface cannot show cost layers per product or a flow map.
- **No delivery read endpoint.** Delivery documents cannot be listed or fetched through the API, so the document chain shows orders, invoices, payments and returns only.
- **No refunds.** Refunds for invoices that are already paid are not supported.
- **Single-process rate limiting.** The rate limiter keeps its counters in memory. With several workers or instances, move it to a shared store such as Redis.
- **Indonesian only.** The interface is available in Indonesian only.

## License

No license file is included yet, so all rights are reserved by the author.

---

<p align="center">Developed by <a href="https://github.com/Rangggase">Rangggase</a></p>
