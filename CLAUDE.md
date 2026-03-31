# Project: [Project Name]

## Overview
[Brief description — 2-3 sentences. Example: "Order management platform for SMEs.
Frontend is React SPA, backend is NestJS REST API, heavy jobs processed by Rust worker."]

## Tech Stack

### Frontend (`/frontend`)
- React 18 + TypeScript + Vite
- TailwindCSS + Shadcn/ui (`components.json` config)
- Zustand for client state (UI, auth session)
- React Query (TanStack Query) for server state (API calls, caching)
- React Router v6 for routing

### Backend API (`/api`)
- NestJS + TypeScript
- Prisma ORM + PostgreSQL
- Passport.js (JWT strategy) for authentication
- Bull/BullMQ + Redis for job queue
- Swagger/OpenAPI auto-generated at `/api/docs`
- Class-validator + class-transformer for DTO validation

### Job Worker (`/jobs`)
- Rust (edition 2021)
- Tokio async runtime
- Redis consumer (reads jobs from BullMQ queue)
- sqlx for Postgres direct access
- Processes: [list job types — email, image processing, reports, etc.]

### Database
- PostgreSQL 16 — primary database
- Redis 7 — job queue + caching + session store

### Infrastructure
- Docker Compose for local dev
- [Deploy platform — Example: AWS ECS, Railway, Fly.io]

## Project Structure
- `/frontend` — React SPA (Vite dev server port 5173)
- `/api` — NestJS REST API (port 3000)
- `/jobs` — Rust job worker (connects to Redis)
- `/shared` — Shared TypeScript types & Zod schemas
- `/infra` — Dockerfiles, scripts, k8s manifests
- `/docs` — PRD, API docs, deployment guide, ADRs
- `/agile` — Backlog, sprints, velocity tracking

## Coding Conventions

### Quality Tooling
- Linter + Formatter: **Biome** (config: `/biome.json`) — run `npx @biomejs/biome check --write .`
- Git hooks: **Lefthook** (config: `/lefthook.yml`) — pre-commit: biome + typecheck + clippy, pre-push: build
- TypeScript: **Maximum strict** — see `tsconfig.json`, NEVER use `any` or `as` cast unless there is a comment explaining
- `exactOptionalPropertyTypes: true` — optional class properties MUST include `| undefined` (e.g., `meta?: PageMeta | undefined`, NOT `meta?: PageMeta`)
- `noPropertyAccessFromIndexSignature: true` — use bracket notation for index signatures (e.g., `process.env["PORT"]`, NOT `process.env.PORT`)
- Rust: **Clippy pedantic** + **rustfmt** (config: `jobs/.clippy.toml`, `jobs/rustfmt.toml`)
- **Dependency pinning: EXACT versions only** — NO `^` or `~` prefix
  - `npm install` adds `^` by default — ALWAYS use `npm install --save-exact` (or `npm i -E`)
  - When adding a new dependency: `npm i -E <package>@<version>`
  - When adding a dev dependency: `npm i -DE <package>@<version>`
  - If you don't know the latest version, run `npm view <package> version` first, then install with `-E`
  - After ANY `npm install` that adds/changes deps, verify `package.json` has no `^` or `~` — fix if found
  - Reason: supply chain security — pinned versions prevent auto-pulling compromised patches
  - Version upgrades are managed centrally via agStack releases, NOT per-project
- Commit: conventional commits — `type(scope): description` (max 72 chars)

### Frontend (`/frontend`)

> **Before building any UI feature, READ these files:**
> 1. `docs/ux-guide.md` — UX principles, component decisions, AND **Mandatory Patterns** section (toast, invalidation, spacing, loading, responsive)
> 2. `frontend/src/components/ui/COMPONENTS.md` — installed Shadcn components
>
> **Non-negotiable UX rules (from ux-guide.md Mandatory Patterns):**
> - Every mutation → toast success + toast error + `invalidateQueries`
> - Every action bar → `flex gap-2 flex-wrap` (no overlapping buttons)
> - Every async action → loading spinner on button + disable while pending
> - Every list/table → empty state with icon + message + CTA
> - Every table → `overflow-x-auto` wrapper for mobile scroll

**Structure:**
- Feature-based: `/src/features/[name]/{components,hooks,queries,stores,types}/`
- Shared components: `/src/components/shared/` — wrapper around Shadcn, DO NOT modify `/components/ui/`
- Path alias: `@/` → `src/`, `@shared/` → `../shared/`

**React patterns:**
- Functional components only, DO NOT use class components
- Custom hooks for reusable logic — prefix `use`, place in `hooks/`
- Props: destructure in parameter, ALWAYS have TypeScript interface (not inline)
- Early return for loading/error states before main render
- Memoize expensive computations: `useMemo` for derived data, `useCallback` for handlers passed to children
- DO NOT use `useEffect` for derived state — compute directly in render

**State management:**
- Zustand: 1 store per domain, max 2 levels nesting, use `immer` middleware if deep update needed
- React Query: query keys = `[feature, action, params]` tuple, queries in `/features/[name]/queries/`
- Server state in React Query, client state in Zustand — DO NOT mix

**UI components (Shadcn/ui):**
- **READ `frontend/src/components/ui/COMPONENTS.md` BEFORE writing any UI**
- Use Shadcn components for ALL interactive elements — DO NOT write raw `<button>`, `<input>`, `<dialog>`, `<select>`
- Install missing components: `npx shadcn@latest add <name>`
- After installing → update COMPONENTS.md with the new entry
- Wrappers in `@/components/shared/` — DO NOT modify `@/components/ui/`
- Icons: use `lucide-react` only — DO NOT use emoji or other icon libraries

**Styling:**
- Tailwind utility classes only — DO NOT write separate CSS files
- Component variants: use `cva` (class-variance-authority) or Shadcn variant pattern
- Responsive: mobile-first (`sm:`, `md:`, `lg:`)
- Dark mode: use Tailwind `dark:` variant

**Error handling:**
- React Error Boundary wrap each route
- React Query `onError` for API errors, display toast
- Form validation: Zod schema + react-hook-form

### Backend NestJS (`/api`)

**Structure:**
- 1 module = 1 feature domain: `/src/modules/[name]/{controller,service,dto,entity}/`
- Common: `/src/common/{guards,interceptors,pipes,filters,decorators}/`
- Config: `/src/config/` — each config in 1 file, validate with Zod

**NestJS patterns:**
- Controller: only receive request + return response, DO NOT contain business logic
- Service: contain business logic, inject via constructor DI
- DTO: class-validator decorators on each field, separate CreateDto / UpdateDto (use PartialType)
- Response: wrap in `BaseResponseDto<T>` = `{ data: T, meta?: PageMeta, error?: string }`
- Auth: Guards > Middleware — use `@UseGuards(JwtAuthGuard)` on controller/method

**Database (Prisma):**
- Schema: `/api/prisma/schema.prisma` — each model has `createdAt`, `updatedAt`
- Migrations: `npx prisma migrate dev --name <name>` — DO NOT edit migration files after creation
- Queries: use Prisma client in service, DO NOT write raw SQL except when performance critical
- Relations: eager loading must be explicit via `include`, DO NOT lazy load
- Transactions: `prisma.$transaction([])` for multi-table writes

**Error handling:**
- Custom exceptions: extend `HttpException` with specific error codes
- Global exception filter: catch all → format `{ statusCode, error, message }`
- Validation pipe: global `ValidationPipe({ whitelist: true, transform: true })`
- DO NOT throw generic `Error()` — always use NestJS exceptions

**Logging:**
- Dev: NestJS built-in Logger, human-readable
- Production: structured JSON, include `requestId`, `userId`, `duration`
- DO NOT use `console.log` — use injected `Logger`

### Rust Jobs (`/jobs`)

**Structure:**
- Each job type = 1 file: `src/jobs/{job_name}.rs`
- Shared: `src/jobs/mod.rs` — registry, job type constants (mirror from `/shared/constants/`)
- Config: `src/config.rs` — env vars via `envy` or manual
- DB: `src/db.rs` — sqlx pool setup

**Rust patterns:**
- Error: custom `AppError` enum implement `thiserror::Error`, all functions return `Result<T, AppError>`
- DO NOT use `.unwrap()` or `.expect()` in production code — only in tests
- Async: Tokio runtime, `#[tokio::main]` at entry point
- Serialization: `serde` derive on all structs, `#[serde(rename_all = "camelCase")]` for JSON compat with TypeScript
- Cloning: prefer borrowing (`&T`) over cloning, use `Arc<T>` for shared ownership across tasks

**Job processing:**
- Dequeue: Redis BRPOP on `jobs:{type}` queue
- Payload: deserialize JSON → typed struct, validate before process
- Retry: max 3, exponential backoff `1s → 4s → 16s`, then → `jobs:dead:{type}`
- Idempotent: each job must be safe to re-run — check before write

**Logging:**
- `tracing` crate with `tracing-subscriber`, structured JSON output
- Each job log: `job_id`, `job_type`, `duration_ms`, `status` (success/failed/retried)
- Span: wrap each job processing in `#[instrument]`

### Shared — All Stacks

**Code quality rules:**
- Functions < 50 lines — split if longer
- Files < 300 lines — split module if longer
- DO NOT leave TODO/FIXME in code merged to main — create task in backlog
- DO NOT commit commented-out code — delete or use feature flag
- Naming: descriptive, DO NOT abbreviate except common conventions (id, url, db, api)

**Shared types:**
- TypeScript: `/shared/types/` — Zod schemas + inferred types
- Frontend imports: use `@shared/types/...` alias — DO NOT use relative paths like `../../../../shared/`
- API imports: use relative `../../shared/` (NestJS module resolution)
- Rust: mirror manually in `jobs/src/types/` — MUST update when shared types change
- Job type constants: `/shared/constants/job-types.ts` → mirror `jobs/src/jobs/mod.rs`

**Testing:**
- Frontend: Vitest + React Testing Library for unit/integration
- API: Jest + supertest for e2e, Jest for unit
- Rust: `#[cfg(test)]` module in each file, `tokio::test` for async
- Test all happy paths + at least 1 error case per function

## Reuse Map — MUST read before writing new code

> **GOLDEN RULE: SEARCH FIRST, WRITE LATER.**
> Before creating a new function/hook/class, MUST check if base/shared code already exists.
> If it exists → extend/compose. If it doesn't exist but logic will be reused → create in shared, DO NOT in feature.

### Frontend — Shared Code Map

| Need | Already exists at | DO NOT write yourself |
|----------|-------------|---------------|
| **UI components** | `@/components/ui/COMPONENTS.md` → Component Decision Map | Raw HTML (`<button>`, `<input>`, `<dialog>`, `<select>`, etc.) |
| Shared wrappers | `@/components/shared/` → project-specific wrappers | Modify `@/components/ui/` directly |
| HTTP calls | `@/lib/api-client.ts` → `api.get/post/put/patch/delete` | fetch() directly |
| Query keys | `@/lib/query-keys.ts` → `queryKeys.feature.action` | Hardcode string keys |
| Paginated list | `@/hooks/use-paginated-query.ts` | Write pagination logic yourself |
| Create/Update/Delete | `@/hooks/use-api-mutation.ts` | Write useMutation + toast yourself |
| Form validation | `@/lib/form-utils.ts` → Zod schemas (`emailSchema`, `passwordSchema`) | Manual validation |
| Debounce | `@/hooks/use-debounce.ts` | setTimeout in component |
| API types | `@/types/api.ts` → `BaseResponse`, `PageMeta` | Define response types per feature |
| Icons | `lucide-react` | Emoji, unicode symbols, or other icon libraries |

**When creating a new feature:**
0. **READ `@/components/ui/COMPONENTS.md`** — find the right Shadcn component for each UI element
1. Add query keys to `@/lib/query-keys.ts`
2. Use `usePaginatedQuery` for list pages
3. Use `useApiMutation` for form submissions
4. Use `api` client for all HTTP calls
5. Use Zod schemas from `form-utils` for validation

### Backend NestJS — Shared Code Map

| Need | Already exists at | DO NOT write yourself |
|----------|-------------|---------------|
| Prisma client | `common/prisma.service.ts` → `PrismaService` (inject via DI) | Create PrismaClient manually |
| CRUD service | `common/base-crud.service.ts` → extend `BaseCrudService` | Copy-paste findAll/create/update/delete |
| CRUD controller | `common/base-crud.controller.ts` → extend `BaseCrudController` | Copy-paste GET/POST/PATCH/DELETE |
| Response format | `common/dto/base-response.dto.ts` → `BaseResponseDto.ok/paginated/created` | Return raw data |
| Pagination | `common/dto/pagination.dto.ts` → `PaginationDto` | Parse page/limit yourself |
| Error handling | `common/filters/http-exception.filter.ts` → global filter | Try-catch per controller |
| Request logging | `common/interceptors/logging.interceptor.ts` → global interceptor | console.log per route |
| Response wrapping | `common/interceptors/transform.interceptor.ts` → auto-wrap | Manual wrap per endpoint |

**When creating a new module:**
1. Add `PrismaService` to module providers (or import a shared PrismaModule)
2. Service extends `BaseCrudService` — inject `PrismaService`, pass to `super(prisma, "modelName")`
3. Controller extends `BaseCrudController` — add custom endpoints alongside CRUD
4. DTOs: use `!:` for required decorated fields, `?: T | undefined` for optional fields (`exactOptionalPropertyTypes`)
5. DTOs use `PaginationDto` for list endpoints
6. Responses use `BaseResponseDto` — DO NOT return raw objects

### Rust Jobs — Shared Code Map

| Need | Already exists at | DO NOT write yourself |
|----------|-------------|---------------|
| Error types | `src/error.rs` → `AppError` enum | Custom error per job |
| Config | `src/config.rs` → `AppConfig::from_env()` | `std::env::var()` directly |
| DB pool | `src/db.rs` → `create_pool()` | Create pool per job |
| Job runner | `src/queue.rs` → `JobRunner` trait | Write Redis dequeue/retry/dead letter yourself |
| Job types | `src/jobs/mod.rs::types` | Hardcode strings |

**When creating a new job:**
1. Create file `src/jobs/{job_name}.rs`
2. Define payload struct with `#[derive(Deserialize, Serialize)]`
3. Implement `JobRunner` trait — only write `process()` method
4. Register in `src/jobs/mod.rs`
5. Mirror type constant to `/shared/constants/job-types.ts`

### Cross-Stack — Shared Code Map

| Need | Already exists at | Who updates? |
|----------|-------------|-----------|
| Job type constants | `/shared/constants/job-types.ts` | API agent, mirrored by Jobs agent |
| Job envelope type | `/shared/types/job-envelope.ts` | API agent |
| API response types | `/shared/types/` | API agent, consumed by FE agent |

## API Conventions
- Base URL: `/api/v1`
- Auth: Bearer token (JWT) in Authorization header
- Pagination: `?page=1&limit=20` → response `{ data, meta: { total, page, limit } }`
- Error format: `{ statusCode, error, message }`
- Swagger UI: `http://localhost:3000/api/docs`

## Job Queue Conventions
- Queue name: `jobs:{type}` (Example: `jobs:email`, `jobs:image`)
- Job payload format: `{ id, type, data, createdAt, attempts }`
- NestJS enqueue → Redis (BullMQ) → Rust worker dequeue & process
- Dead letter queue: `jobs:dead` for failed jobs after max retries

## Reference Feature (Dummies)

> The Dummies module is a **reference implementation** included in this boilerplate.
> It demonstrates all coding patterns and conventions end-to-end.
> Run `npm run scaffold:clean` to remove all Dummies code when starting a real project.

**Before implementing a new feature, READ the Dummies module to learn the code style:**

| Layer | Reference file | What it demonstrates |
|-------|---------------|---------------------|
| Shared types | `shared/types/dummy.ts` | Zod schemas, enums as const, entity → public type |
| API DTO | `api/src/modules/dummies/dto/create-dummy.dto.ts` | class-validator decorators, Swagger annotations |
| API Service | `api/src/modules/dummies/dummies.service.ts` | BaseCrudService extension, custom methods, field exclusion |
| API Controller | `api/src/modules/dummies/dummies.controller.ts` | BaseCrudController extension, custom endpoints |
| API Test | `api/src/modules/dummies/__tests__/dummies.service.spec.ts` | Mock Prisma, happy path + error cases |
| FE Types | `frontend/src/features/dummies/types/index.ts` | Re-export shared + frontend-specific types |
| FE Queries | `frontend/src/features/dummies/queries/use-dummies.ts` | usePaginatedQuery, useApiMutation, queryKeys |
| FE Component | `frontend/src/features/dummies/components/dummy-list.tsx` | List pattern: search, filter, table, pagination, skeleton |
| FE Test | `frontend/src/features/dummies/components/dummy-list.test.tsx` | Mock hooks, test loading/data/empty/error states |

## Multi-Agent Rules

### READ before starting
1. Read this file (CLAUDE.md) to understand the project
2. Read `.claude/agents/[your-name].md` to understand your context
3. Read ARCHITECTURE.md if you need to understand architecture
4. Read `agile/sprints/current.md` to know current sprint

### WRITE while working
- WRITE to `.claude/agents/[your-name].md` — DO NOT edit CLAUDE.md
- DO NOT run /document-release — let CI handle it
- DO NOT edit CHANGELOG.md, README.md directly
- MAY edit ARCHITECTURE.md if architecture changes (but should go through PR)
- Update task status in `agile/sprints/sprint-XX/SPRINT.md`

### Development Modes

Choose a mode when starting a sprint via `/plan-sprint`:

**Standard Mode (recommended)** — sequential agents, 1 branch per task, 1 PR per task.
- Branch: `feat/TASK-XXX-[description]` per task
- Run agent-api → then agent-frontend → then agent-jobs sequentially
- Each task: branch → code → `/review` → `/qa` → PR → merge
- Best for: most sprints, dependent tasks, clean git history

**Hero Mode** — parallel agents, 1 branch per sprint, 1 PR.
- Branch: `sprint/sprint-XX`
- Agents work simultaneously on the SAME branch, staying in their file ownership lanes
- End of sprint: `/review` + `/qa` the entire branch → 1 PR to main
- Best for: sprints with many tasks, independent work, maximum speed

### Avoid conflict
- Shared files (CLAUDE.md, ARCHITECTURE.md) only edited via PR + review
- Agent-specific files never conflict because each agent has their own file

### Ownership boundaries (enforced in both modes)
| Resource | Owner | Others |
|----------|-------|--------|
| `/shared/types/*` | agent-api | READ only |
| `/api/prisma/schema.prisma` | agent-api | READ only |
| `/frontend/src/components/ui/*` | Shadcn-managed | Wrap in `/components/shared/` |
| `/frontend/src/features/*` | agent-frontend | agent-api never touches |
| `/api/src/modules/*` | agent-api | agent-frontend never touches |
| `.claude/agents/[name].md` | that agent only | Never modify another agent's file |

### Spawn order (both modes)
1. agent-api FIRST — owns shared types and database schema
2. agent-frontend SECOND — consumes API types and endpoints
3. agent-jobs ONLY if sprint has job-related tasks

See `/plan-sprint` Step 6 for full spawn instructions per mode.

## Environment Variables
- Frontend: `VITE_API_URL`, `VITE_APP_ENV`
- API: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`
- Jobs: `DATABASE_URL`, `REDIS_URL`, `RUST_LOG`, `WORKER_CONCURRENCY`
- See `.env.example` for full list

## Key Decisions
- NestJS over Express: need module system, DI, and decorator-based validation
  → ADR: docs/decisions/001-nestjs-over-express.md
- Rust for jobs: CPU-intensive tasks (image processing, report gen) need performance
  → ADR: docs/decisions/002-rust-for-jobs.md
- Zustand over Redux: simpler API, less boilerplate, sufficient for this app scale
  → ADR: docs/decisions/003-zustand-over-redux.md
- Redis for both queue + cache: reduce infrastructure complexity
  → ADR: docs/decisions/004-redis-caching-strategy.md
- Epic → Task (skip Story): gStack /office-hours already covers "as a user" narrative
  → ADR: docs/decisions/005-epic-task-no-story.md

## Dev Setup

**New project**: Run `/setup` in Claude Code — it generates package.json, Prisma schema,
app entry points, and gets dev server running. Then `/office-hours` for product planning.

**Files generated by `/setup`** (not in boilerplate template):
- `package.json` (root, frontend/, api/)
- `jobs/Cargo.toml`
- `api/prisma/schema.prisma`
- `api/src/main.ts` (NestJS entry point)
- `frontend/src/app/main.tsx` (React entry point)
- `frontend/index.html`

**Manual setup** (after `/setup` has generated the above):
```bash
cp .env.example .env        # adjust if needed
docker-compose up -d         # postgres + redis
cd frontend && npm install && npm run dev
cd api && npm install && npx prisma migrate dev && npm run start:dev
cd jobs && cargo build && cargo run
```

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review,
/plan-sprint, /plan-design-review, /design-consultation, /review, /ship,
/land-and-deploy, /canary, /benchmark, /browse, /qa, /qa-only,
/design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate,
/document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade.

**Planning flow:** /office-hours → /plan-ceo-review → /plan-eng-review → /plan-sprint
Run `/plan-sprint` immediately after `/plan-eng-review` to create Epics, Tasks, and Sprint backlog.

If gstack skills aren't working, run:
cd .claude/skills/gstack && ./setup
