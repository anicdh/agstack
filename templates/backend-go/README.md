# Backend (Go)

agStack provides the React frontend. You own this Go backend.

## Quick start

```bash
# From repo root — start Postgres + Redis
docker-compose up -d

# In this directory
cp ../.env .env          # reuse root .env for DATABASE_URL
go mod tidy
go run ./cmd/api         # or: air (for hot reload)
```

Health check: `curl http://localhost:3000/api/v1/health`

## Structure

```
cmd/api/main.go           — HTTP server entry point (Chi router)
internal/handlers/         — HTTP handlers
internal/db/               — Postgres connection pool (pgx)
internal/models/           — Domain types (add as needed)
internal/queue/            — Redis queue consumer (add if needed)
```

## Libraries

| Purpose | Library | Why |
|---------|---------|-----|
| Router | chi v5 | Lightweight, idiomatic, stdlib-compatible |
| Database | pgx v5 | Fastest Go Postgres driver, pool built-in |
| Queue (optional) | asynq | Redis-backed job queue, matches BullMQ conventions |

## Frontend integration

The React frontend expects `VITE_API_URL` (in `frontend/.env`) to point at this
service. Default: `http://localhost:3000/api/v1`.

All routes should be under `/api/v1/` to match the frontend's api-client.

## Docker

`docker-compose.yml` in the repo root provides Postgres + Redis.
Add a service for this Go backend when you're ready to containerize:

```yaml
api:
  build: ./backend-go
  ports:
    - "3000:3000"
  env_file: .env
  depends_on:
    - postgres
    - redis
```
