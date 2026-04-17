# Architecture

## System Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   NestJS     │────▶│  PostgreSQL   │
│  React SPA   │     │   REST API   │     │              │
│  :5173       │     │   :3000      │     │  :5432       │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │                     ▲
                            │ enqueue              │ read/write
                            ▼                     │
                     ┌──────────────┐     ┌───────┴──────┐
                     │    Redis     │────▶│  Rust Worker  │
                     │  Queue+Cache │     │  Job Process  │
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
1. NestJS Service → BullMQ Producer → Redis queue
2. Rust Worker (tokio) → Redis consumer → dequeue job
3. Rust processes job → direct Postgres write (sqlx)
4. Job result → Redis pub/sub → NestJS listener (optional)
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
- Rust Worker: scale instances independently, Redis-based coordination
- Database: connection pooling via PgBouncer in production
- Redis: Sentinel or Cluster mode for HA

---
*Updated by gStack /plan-eng-review and /document-release*
