# Deployment

## Environment

Copy `backend/.env.example` to `backend/.env`.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `sqlite:///./data/aether_erp.db` or `postgresql+psycopg://user:pass@host:5432/aether_erp` |
| `SECRET_KEY` | Long random string; never reuse the development default |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | Token lifetimes |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `RATE_LIMIT_PER_MINUTE`, `LOGIN_RATE_LIMIT_PER_MINUTE` | Per-IP limits |
| `PO_APPROVAL_THRESHOLD` | Purchase orders above this need approval |

## PostgreSQL

1. Create the database and role.
2. Set `DATABASE_URL`, then run `alembic upgrade head` from `backend/`.
3. Load reference data (roles, permissions, chart of accounts, branches, fiscal periods): `python -m app.cli init`. Add `seed` instead of `init` only for demo data.
4. Create the first administrator with `python -m app.cli createadmin EMAIL PASSWORD`, then add other users. Do not load demo data in production.

Schema changes: edit models, then `alembic revision --autogenerate -m "describe change"` and `alembic upgrade head`.

## Running

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
cd frontend && npm run build   # serve frontend/dist behind a reverse proxy that forwards /api to the backend
```

Terminate TLS at the proxy. The rate limiter is in-process, so with several workers or instances move it to a shared store such as Redis.

## Pre-release checklist

- `pytest` and `npm run typecheck` pass.
- `SECRET_KEY` and database credentials come from the environment, not the repository.
- Fiscal periods exist for the coming year.
- Backups are scheduled for the database.

