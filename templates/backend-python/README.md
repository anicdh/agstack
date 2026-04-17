# Backend (Python)

agStack provides the React frontend. You own this Python backend.

## Quick start

```bash
# From repo root — start Postgres + Redis
docker-compose up -d

# In this directory
cp ../.env .env                          # reuse root .env for DATABASE_URL
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 3000
```

Health check: `curl http://localhost:3000/api/v1/health`
Swagger docs: `http://localhost:3000/api/docs`

## Structure

```
app/main.py               — FastAPI application + CORS + lifespan
app/routers/               — HTTP route modules
app/db/engine.py           — Async SQLAlchemy engine (asyncpg)
app/models/                — SQLAlchemy / Pydantic models (add as needed)
app/workers/               — Celery / RQ tasks (add if needed)
```

## Libraries

| Purpose | Library | Why |
|---------|---------|-----|
| Framework | FastAPI 0.115 | Async, auto-docs, Pydantic validation |
| Database | SQLAlchemy 2.0 + asyncpg | Async ORM, fast Postgres driver |
| Queue (optional) | Celery + Redis | Mature, matches Redis already in stack |
| Linter | Ruff | Fast, replaces flake8/isort/black |

## Frontend integration

The React frontend expects `VITE_API_URL` (in `frontend/.env`) to point at this
service. Default: `http://localhost:3000/api/v1`.

All routes should be under `/api/v1/` to match the frontend's api-client.

## Docker

`docker-compose.yml` in the repo root provides Postgres + Redis.
Add a service for this Python backend when you're ready to containerize:

```yaml
api:
  build: ./backend-python
  ports:
    - "3000:3000"
  env_file: .env
  depends_on:
    - postgres
    - redis
```
