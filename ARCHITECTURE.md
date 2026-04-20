# Architecture

> **This diagram shows the general architecture.** The default profile is `nestjs-only`. For other profiles:
> - `nestjs-only` (default): Job Worker = BullMQ Processor inside `/api`
> - `nestjs-rust`: Job Worker = separate Rust binary in `/jobs` (copied from `/templates/jobs-rust` by `/setup`)
> - `go-only`: replace "Backend REST API" with "Go Backend"; job worker is user-owned
> - `python-only`: replace "Backend REST API" with "Python Backend"; job worker is user-owned

## System Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React SPA   │     │   REST API   │     │              │
│  :5173       │     │   :3000      │     │  :5432       │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │                     ▲
                            │ enqueue              │ read/write
                            ▼                     │
                     ┌──────────────┐     ┌───────┴──────┐
                     │    Redis     │────▶│  Job Worker   │
                     │  Queue+Cache │     │  (see note)   │
                     │  :6379       │     │              │
                     └──────────────┘     └──────────────┘
```

## Data Flow

### Request Flow (Synchronous)
1. Browser → React SPA (Vite dev / Nginx prod)
2. React Query → `api-client.ts` → NestJS Controller
3. Controller → Service → Prisma → PostgreSQL
4. Response → TransformInterceptor → JSON → React Query cache

### Job Flow (Asynchronous)
1. Backend service → BullMQ/Redis producer → Redis queue
2. Job worker dequeues job (Rust worker for nestjs-rust, BullMQ processor for nestjs-only, user-owned for go/python)
3. Worker processes job → Postgres write
4. Job result → Redis pub/sub → backend listener (optional)
5. Frontend polls or WebSocket receives result

### Caching Flow
1. NestJS checks Redis cache → hit → return cached
2. Cache miss → Prisma query → store in Redis (TTL-based)
3. Write operations → invalidate related cache keys

## Database Schema

### Core Tables
- [Add your domain tables here]

### Indexes
- [Add your indexes here]

## Security
- JWT access token (15min) + refresh token (7d) in httpOnly cookie
- Password: bcrypt, min 12 rounds
- Rate limiting: @nestjs/throttler, 100 req/min per IP
- CORS: whitelist frontend origin only
- Input validation: class-validator on all DTOs
- SQL injection: Prisma parameterized queries
- XSS: React auto-escapes, CSP headers

## Scalability Notes
- Frontend: CDN-ready static build
- API: stateless, horizontal scale behind load balancer
- Job Worker: scale instances independently, Redis-based coordination (nestjs-rust: Rust binary; nestjs-only: NestJS process; go/python: user-owned)
- Database: connection pooling via PgBouncer in production
- Redis: Sentinel or Cluster mode for HA

---
*Updated by gStack /plan-eng-review and /document-release*
