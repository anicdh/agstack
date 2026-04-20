# ADR 001: Backend Framework Strategy (Profile-Based)

## Status
Accepted (updated — originally "NestJS over Express", now multi-profile)

## Context
agStack supports multiple stack profiles. Each profile needs a backend framework
that balances developer experience, ecosystem, and performance for its runtime.
The framework choice is made during `/tech-stack-consult` based on team skills
and project requirements.

## Decision
Backend framework is determined by the stack profile:

| Profile | Framework | Why this framework |
|---------|-----------|-------------------|
| **nestjs-only** (default) | NestJS (on Express) | Module system + DI + decorators = consistent structure at scale |
| **nestjs-rust** | NestJS (API) + Rust (jobs) | Same NestJS benefits for API; Rust for CPU-intensive workers |
| **go-only** | Chi + pgx + sqlc | Lightweight, fast, idiomatic Go — minimal magic |
| **python-only** | FastAPI + SQLAlchemy | Modern async Python, auto-generated OpenAPI, type hints |

The default is **nestjs-only** — it covers the widest range of web apps with
the best balance of structure, ecosystem, and developer productivity.

## Why NestJS is the default (nestjs-only, nestjs-rust)
- Built-in module system with dependency injection — enforces consistent project structure
- Decorator-based validation (class-validator) — cleaner than manual middleware
- First-class Swagger/OpenAPI generation — auto-docs from decorators
- Guards, interceptors, pipes, filters — layered architecture out of the box
- Large ecosystem: @nestjs/passport, @nestjs/bullmq, @nestjs/config, etc.
- TypeScript-first — shared types with frontend, no separate definitions

## Why Chi for Go (go-only)
- Lightweight router, idiomatic Go — no framework magic
- pgx for high-performance Postgres access (connection pooling built-in)
- sqlc for type-safe SQL — generates Go code from SQL queries
- Compiles to single binary — simple deployment
- Goroutines for natural concurrency

## Why FastAPI for Python (python-only)
- Async-first with ASGI — handles concurrent requests well
- Auto-generated OpenAPI docs (like NestJS Swagger)
- Pydantic for request/response validation with type hints
- SQLAlchemy 2.0 for ORM with async support
- Largest ecosystem for data/ML integration

## Trade-offs by profile

### NestJS (nestjs-only, nestjs-rust)
- ✅ Rich ecosystem, structured architecture, shared types with frontend
- ❌ Steeper learning curve (DI, decorators), heavier runtime than minimal Express

### Go (go-only)
- ✅ Fast compilation, excellent concurrency, single binary deploy
- ❌ Verbose error handling, smaller web framework ecosystem, no shared types with TS frontend

### Python (python-only)
- ✅ Largest talent pool, best data/ML ecosystem, readable syntax
- ❌ Slower runtime, GIL limits parallelism, separate type system from TS frontend

## Alternatives considered (for default)
- **Raw Express**: Too minimal — leads to inconsistent project structures across features
- **Fastify**: Faster raw performance, but smaller ecosystem and no built-in module system
- **Hono**: Ultra-lightweight, good for edge — but less mature ecosystem for full backend
