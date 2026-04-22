# Project: [Project Name]

## Overview
[Brief description — 2-3 sentences. Example: "Order management platform for SMEs.
Frontend is React SPA, backend handles REST API and async jobs per stack profile."]

## Team Mode: [solo | team]
<!-- Set by /setup. "solo" = 1 dev + AI agents. "team" = multiple devs + AI agents. -->
<!-- Team mode enables: file claims, conflict detection, PR-based workflow, branch protection. -->

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

### Job Worker
- **nestjs-rust profile**: Rust (edition 2021) in `/jobs` (copied from `/templates/jobs-rust` by `/setup`) — Tokio async, sqlx for Postgres, Redis consumer
- **nestjs-only profile**: BullMQ processors inside NestJS (`/api/src/workers/`)
- **go-only / python-only**: User-owned — your backend handles async jobs
- Processes: [list job types — email, image processing, reports, etc.]

### Database
- PostgreSQL 16 — primary database
- Redis 7 — job queue + caching + session store

### Infrastructure
- Docker Compose for local dev
- [Deploy platform — Example: AWS ECS, Railway, Fly.io]

## Project Structure
- `/frontend` — React SPA (Vite dev server port 5173)
- `/api` — NestJS REST API (port 3000) — NestJS profiles only
- `/jobs` — Rust job worker (created by `/setup` from `/templates/jobs-rust`) — nestjs-rust only
- `/backend-go` — Go backend — go-only profile only
- `/backend-python` — Python backend — python-only profile only
- `/shared` — Shared TypeScript types & Zod schemas — NestJS profiles only
- `/templates` — Starter templates for Go, Python, BullMQ worker
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
- Rust (nestjs-rust only): **Clippy pedantic** + **rustfmt** (config: `jobs/.clippy.toml`, `jobs/rustfmt.toml`)
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
> 1. `.claude/skills/frontend-ui/SKILL.md` — Tailwind conventions, Shadcn component map, layout patterns, responsive
> 2. `docs/ux-guide.md` — UX principles, component decisions, AND **Mandatory Patterns** section (toast, invalidation, spacing, loading, responsive)
>
> **Non-negotiable UX rules (from ux-guide.md Mandatory Patterns):**
> - Every mutation → toast success + toast error + `invalidateQueries`
> - Every action bar → `flex gap-2 flex-wrap` (no overlapping buttons)
> - Every async action → loading spinner on button + disable while pending
> - Every list/table → empty state with icon + message + CTA
> - Every table → `overflow-x-auto` wrapper for mobile scroll

- Feature-based structure: `/src/features/[name]/{components,hooks,queries,stores,types}/`
- Shared components: `/src/components/shared/` — wrapper around Shadcn, DO NOT modify `/components/ui/`
- Path alias: `@/` → `src/`, `@shared/` → `../shared/`
- Shadcn for ALL interactive elements — DO NOT write raw `<button>`, `<input>`, `<dialog>`, `<select>`
- Icons: `lucide-react` only — DO NOT use emoji or other icon libraries
- Tailwind utility classes only — DO NOT write separate CSS files
- Server state in React Query, client state in Zustand — DO NOT mix
- See `.claude/agents/agent-frontend.md` for full checklist and anti-patterns

### Backend NestJS (`/api`)

- 1 module = 1 feature domain: `/src/modules/[name]/{controller,service,dto,entity}/`
- Controller: only receive request + return response, NO business logic
- Service: business logic, inject via constructor DI
- DTO: class-validator decorators on each field, separate CreateDto / UpdateDto
- Response: wrap in `BaseResponseDto<T>`, NEVER return raw objects
- Auth: `@UseGuards(JwtAuthGuard)` on protected endpoints
- Prisma: explicit `include` for relations, `$transaction` for multi-writes
- DO NOT use `console.log` — use injected `Logger`
- See `.claude/agents/agent-api.md` for full checklist and anti-patterns

### TypeScript — All TS/TSX (`/api`, `/frontend`)

- **Before writing any `.ts`/`.tsx` file, READ `.claude/skills/typescript/SKILL.md`** — strict mode rules, type safety, async patterns
- **Before any Prisma/DB work, READ `.claude/skills/postgres/SKILL.md`** — schema design, migrations, query patterns

### Rust Jobs (`/jobs`)

- **Before writing any `.rs` file, READ `.claude/skills/rust/SKILL.md`** — error handling, async patterns, type safety
- Each job type = 1 file: `src/jobs/{job_name}.rs`, implement `JobRunner` trait
- Error: custom `AppError` enum, all functions return `Result<T, AppError>`, NO `.unwrap()` in production
- Logging: `tracing` crate with `#[instrument]`, structured JSON
- Retry: max 3, exponential backoff, then dead letter queue
- See `.claude/agents/agent-jobs.md` for full checklist and anti-patterns

### Shared — All Stacks

- Functions < 50 lines, files < 300 lines — split if longer
- DO NOT leave TODO/FIXME in code merged to main — create task in backlog
- DO NOT commit commented-out code — delete or use feature flag
- Shared types: `/shared/types/` — Zod schemas + inferred types
- Job type constants: `/shared/constants/job-types.ts` → mirror in your worker profile (see file comments)

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
| Redis / Cache | `common/cache/cache.module.ts` → `CacheModule` + `CacheService` (inject via DI) | `new Redis()`, `createClient()`, or any direct Redis connection |
| Job queue | `@nestjs/bullmq` → `@InjectQueue('jobs:type')` via `BullModule.registerQueue()` | Manual Redis LPUSH/BRPOP for job queuing |

### Rust Jobs — Shared Code Map

| Need | Already exists at | DO NOT write yourself |
|----------|-------------|---------------|
| Error types | `src/error.rs` → `AppError` enum | Custom error per job |
| Config | `src/config.rs` → `AppConfig::from_env()` | `std::env::var()` directly |
| DB pool | `src/db.rs` → `create_pool()` | Create pool per job |
| Job runner | `src/queue.rs` → `JobRunner` trait | Write Redis dequeue/retry/dead letter yourself |
| Job types | `src/jobs/mod.rs::types` | Hardcode strings |

### Cross-Stack — Shared Code Map

| Need | Already exists at | Who updates? |
|----------|-------------|-----------|
| Job type constants | `/shared/constants/job-types.ts` | API agent, mirrored by worker per profile |
| Job envelope type | `/shared/types/job-envelope.ts` | API agent, mirrored by worker per profile |
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

## Multi-Agent Rules

### READ before starting
1. Read `.claude/rules/anti-hallucination.md` — MANDATORY for all agents
2. Read this file (CLAUDE.md) to understand the project
3. Read `.claude/agents/[your-name].md` — includes your Required Reading list
4. Read ARCHITECTURE.md if you need to understand architecture
5. Read `agile/sprints/current.md` to know current sprint
6. Check GitNexus: `npx gitnexus status` — if available, use it for code navigation (see `.claude/skills/gitnexus/SKILL.md`)

### WRITE while working
- WRITE to `.claude/agents/[your-name].md` — DO NOT edit CLAUDE.md
- DO NOT run /document-release — let CI handle it
- DO NOT edit CHANGELOG.md, README.md directly
- MAY edit ARCHITECTURE.md if architecture changes (but should go through PR)
- Update task status in `agile/sprints/sprint-XX/SPRINT.md`

### Development Modes

Choose a mode when starting a sprint via `/plan-sprint`:

**Standard Mode (recommended)** — sequential for blockers, parallel fan-out via worktrees for independent tasks. 1 branch per task, 1 PR per task. See `/plan-sprint` Step 6a.
**Hero Mode** — parallel agents, 1 branch per sprint, 1 PR.

See `/plan-sprint` Step 6 for full details on each mode.

### Model assignment by agent role

Each agent declares its model in frontmatter (`model: sonnet` or `model: opus`).
This controls token usage — Sonnet is significantly cheaper and has 200k context.

| Role | Model | Rationale |
|------|-------|-----------|
| Coding agents (api, frontend, jobs) | **sonnet** | Implementation tasks — Sonnet handles coding well |
| Planning agents (plan-sprint) | **opus** | Deep reasoning, architecture decisions |
| Design agent (product-design) | **opus** | Creative UX decisions, flow design |
| Review agents (review, qa) | **sonnet** | Pattern matching, checklist execution |

To override for a specific agent, change `model:` in its frontmatter.
To override for a single spawn, pass `model: "opus"` in the Agent tool call.

### Agent routing by stack profile

Check `.agstack/stack.json` at session start. The profile determines which agents are active:

| Profile | Backend agent | Jobs agent | Frontend agent |
|---------|--------------|------------|----------------|
| `nestjs-rust` | `agent-api` | `agent-jobs` | `agent-frontend` |
| `nestjs-only` | `agent-api` (also handles BullMQ jobs) | INACTIVE | `agent-frontend` |
| `go-only` | `agent-api-go` | INACTIVE | `agent-frontend` |
| `python-only` | `agent-api-python` | INACTIVE | `agent-frontend` |

If no `.agstack/stack.json` exists, default to `nestjs-only` (agent-api + agent-frontend active, agent-jobs INACTIVE).

### Ownership boundaries (enforced in both modes)

**NestJS profiles (`nestjs-rust`, `nestjs-only`):**
| Resource | Owner | Others |
|----------|-------|--------|
| `/shared/types/*` | agent-api | READ only |
| `/api/prisma/schema.prisma` | agent-api | READ only |
| `/frontend/src/components/ui/*` | Shadcn-managed | Wrap in `/components/shared/` |
| `/frontend/src/features/*` | agent-frontend | agent-api never touches |
| `/api/src/modules/*` | agent-api | agent-frontend never touches |
| `.claude/agents/[name].md` | that agent only | Never modify another agent's file |

**Go profile (`go-only`):**
| Resource | Owner | Others |
|----------|-------|--------|
| `/backend-go/internal/*` | agent-api-go | READ only |
| `/frontend/src/components/ui/*` | Shadcn-managed | Wrap in `/components/shared/` |
| `/frontend/src/features/*` | agent-frontend | agent-api-go never touches |
| `.claude/agents/[name].md` | that agent only | Never modify another agent's file |

**Python profile (`python-only`):**
| Resource | Owner | Others |
|----------|-------|--------|
| `/backend-python/app/*` | agent-api-python | READ only |
| `/frontend/src/components/ui/*` | Shadcn-managed | Wrap in `/components/shared/` |
| `/frontend/src/features/*` | agent-frontend | agent-api-python never touches |
| `.claude/agents/[name].md` | that agent only | Never modify another agent's file |

### Spawn order (both modes)
1. Backend agent FIRST (agent-api / agent-api-go / agent-api-python) — owns API and database
2. agent-frontend SECOND — consumes API types and endpoints
3. agent-jobs ONLY if profile == `nestjs-rust` AND sprint has job-related tasks

### Team Mode Rules (only when Team Mode = team)

> See `.claude/agents/TEAM-RULES.md` for full team workflow: branch protection, file claims,
> conflict detection, PR workflow, and communication protocol.
> Solo mode skips all of this — the single dev + AI agents use Standard/Hero Mode above.

**⛔ HARD RULES (Team Mode = team) — applies to ALL agents, ALL workflows:**

1. **NEVER create PRs targeting `main`** — all PRs MUST target `sprint/sprint-XX`
2. **NEVER push directly to `main`** — main is protected, only receives code via sprint PR after QA
3. **BEFORE any git operation**, check if a sprint branch exists:
   ```bash
   git branch -a | grep sprint/
   ```
   - If sprint branch exists → use it as base and PR target
   - If no sprint branch → STOP and ask the user which sprint branch to use
4. **MUST read `.claude/agents/TEAM-RULES.md`** at session start — not optional
5. **The ONLY way code reaches `main`**: sprint branch → QA passes → manual PR → all devs approve

These rules apply regardless of whether `/plan-sprint` was run. If `Team Mode = team`,
the sprint branch workflow is mandatory.

## Environment Variables
- Frontend: `VITE_API_URL`, `VITE_APP_ENV`
- API (NestJS profiles): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`
- Jobs (nestjs-rust only): `DATABASE_URL`, `REDIS_URL`, `RUST_LOG`, `WORKER_CONCURRENCY`
- Go/Python backends: `DATABASE_URL`, `REDIS_URL`, `PORT` (+ framework-specific vars)
- See `.env.example` for full list — `/setup` adjusts this based on your stack profile

## Key Decisions
- Backend framework is profile-based: NestJS (default), Chi (Go), FastAPI (Python)
  → ADR: docs/decisions/001-backend-framework-strategy.md
- Job worker strategy is profile-based: BullMQ (default), Rust, asynq, or Celery
  → ADR: docs/decisions/002-job-worker-strategy.md
  → Profile chosen during `/tech-stack-consult`
- Zustand over Redux: simpler API, less boilerplate, sufficient for this app scale
  → ADR: docs/decisions/003-zustand-over-redux.md
- Redis for both queue + cache: reduce infrastructure complexity
  → ADR: docs/decisions/004-redis-caching-strategy.md
- Epic → Task (skip Story): gStack /office-hours already covers "as a user" narrative
  → ADR: docs/decisions/005-epic-task-no-story.md

## Dev Setup

Run `/tech-stack-consult` FIRST — 5 quick questions that decide whether this
project needs `nestjs-only` (default — BullMQ worker inside NestJS), `nestjs-rust`
(adds Rust worker for CPU-heavy jobs), or a different stack entirely. Output is
saved to `.agstack/stack.json`.

Then run `/setup` — it reads `.agstack/stack.json`, copies templates, replaces
project name, applies the stack profile (copies `/jobs` from templates for nestjs-rust), installs
deps, starts Docker, runs migrations, and gets dev servers running. Then
`/office-hours` for product planning.

If you skip `/tech-stack-consult`, `/setup` will warn you and default to `nestjs-only`.

**Manual setup:**
```bash
cp .env.example .env        # adjust if needed
docker-compose up -d         # postgres + redis
npm install                  # install all workspaces
cd api && ln -sf ../.env .env && npx prisma migrate dev && npm run start:dev
cd frontend && npm run dev
cp -r templates/jobs-rust jobs && cd jobs && cargo build && cargo run   # nestjs-rust profile only
```

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review,
/plan-sprint, /plan-design-review, /design-consultation, /review, /ship,
/land-and-deploy, /canary, /benchmark, /browse, /qa, /qa-only,
/design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate,
/document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade.

**Planning flow:**
```
/office-hours → /plan-ceo-review → /plan-eng-review → /product-owner-review
                                                              ↓
                                        technical-epic → /plan-sprint (directly)
                                        user-oriented-epic → product-design agent → design approved → /plan-sprint
```

- `/product-owner-review` breaks plan into epics, classifies as technical or user-oriented
- User-oriented epics MUST have design approved before entering sprint
- Technical epics go straight to `/plan-sprint`

If gstack skills aren't working, run:
cd .claude/skills/gstack && ./setup

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
