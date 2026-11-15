# API contract

Base path `/api/v1`. Interactive reference: `/api/docs`. All endpoints except `/auth/login`, `/auth/refresh`, `/auth/logout` and `/api/health` need `Authorization: Bearer <access token>`.

Money and quantities are returned as exact decimal strings. Errors use `{"detail": "..."}` with 401 (not signed in), 403 (missing permission), 404, 409 (state or constraint conflict, closed period, insufficient stock, credit limit) or 422 (validation, unbalanced journal).

## Auth

| Method and path | Purpose |
| --- | --- |
| `POST /auth/login` | Email and password, returns access and refresh tokens |
| `POST /auth/refresh` | Rotates the refresh token; a replayed token revokes the family |
| `POST /auth/logout` | Revokes the token family |
| `GET /auth/me` | Profile and permission codes |
| `POST /auth/change-password` | Needs the current password; revokes every refresh token of the user |

## Accounting (`accounting.read`, writes need `accounting.post` or `accounting.close`)

| Endpoint | Notes |
| --- | --- |
| `GET /accounting/accounts`, `/periods` | Chart of accounts, fiscal periods |
| `POST /accounting/periods/{id}/close`, `/reopen` | Audited. Months close in order and reopen in reverse; a draft stock count dated in the month blocks closing; a year with closing entries cannot be reopened |
| `POST /accounting/year-end/{year}/close` | Needs `accounting.close` and `accounting.post`. Requires January to November closed and December open. Posts one `CLOSING` entry per branch moving profit to retained earnings (3200), then closes December |
| `GET /accounting/journals` | Filters: `branch_id`, `start`, `end`, `source_type`, paging |
| `POST /accounting/journals` | Manual entry; must balance |
| `POST /accounting/journals/{id}/reverse` | Posts a mirrored entry and marks the original `REVERSED` |
| `GET /accounting/reports/general-ledger` | `account_code`, `start`, `end`, optional `branch_id` |
| `GET /accounting/reports/trial-balance`, `/balance-sheet` | `as_of` |
| `GET /accounting/reports/income-statement` | `start`, `end` |
| `GET /accounting/reports/aging/{AP\|AR}` | Buckets: not due, 1-30, 31-60, 61-90, over 90 days past due |

## Procurement

`GET/POST /procurement/purchase-orders`, then `POST .../{id}/submit`, `/approve`, `/receive`, `/bill`; `GET /procurement/goods-receipts`.

## Inventory

`GET /inventory/balances`, `/movements`, `/valuation`, `/reorder-recommendations`; `GET/POST /inventory/transfers` with `/{id}/dispatch` and `/receive`; `GET/POST /inventory/work-orders` with `/{id}/complete`; `GET/POST /inventory/stock-counts` with `/{id}/post`.

## Sales

`GET/POST /sales/orders` with `/{id}/confirm`, `/cancel`, `/deliver`, `/invoice`; `GET /invoices`; `POST /invoices/{id}/payments`.

## Master data, dashboard, system

`/master/{branches,categories,products,suppliers,customers,boms}`; `GET /dashboard/overview?branch_id=`; `GET /audit-logs` (`audit.read`).

User administration (`users.manage`): `GET /system/users`, `GET /system/roles`, `POST /system/users`, `PATCH /system/users/{id}` (name, role, branch, `is_active`), `POST /system/users/{id}/reset-password`. Passwords need at least 10 characters with a letter and a digit. Role changes and deactivation revoke refresh tokens, and permissions are read from the database on every request, so they apply at once. The last active administrator cannot be demoted or deactivated, and nobody can deactivate themselves.

`GET /invoices/{id}` (`accounting.read`) returns the invoice with party, source lines and payments; the frontend renders it as a printable invoice or supplier bill.

## Permissions

`dashboard.read`, `master.read/write`, `accounting.read/post/close`, `procurement.read/write/approve`, `inventory.read/write`, `sales.read/write`, `payments.write`, `users.manage`, `audit.read`.
