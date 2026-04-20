---
name: setup
description: >
  Use when initializing a new project from agStack boilerplate.
  Copies templates, replaces project name, installs deps, starts
  Docker, runs migrations. Run once at project start.
invocation: manual
---

# /setup — Project Onboarding

> Progressive setup for new projects using this starter kit.
> Starts with infrastructure, then hands off to gStack for product planning.

## When to use
Run `/setup` when cloning this starter kit for a new project.

## Instructions

You are helping a solo developer set up a new project from the agStack starter kit.
The setup is split into two phases:
- **Phase A (this skill)**: Get the project RUNNABLE — infra, deps, dev server.
- **Phase B (gStack)**: Plan the product and build features via `/office-hours`.

Phase A should be fast — get to a working `npm run dev` ASAP.
Phase B is where the real product decisions happen.

**Before Phase A: check the stack profile.** If `.agstack/stack.json` does not
exist, run `/tech-stack-consult` first. Without a profile, `/setup` assumes
`nestjs-only` (NestJS + BullMQ, no Rust). See Step 0.5 below.

**CRITICAL — DO NOT regenerate boilerplate code. COPY + REPLACE only.**

The starter kit ships with EVERYTHING pre-built and tested, including pinned
dependency versions. /setup should NOT write any file from scratch.
The ONLY things /setup does:
1. Copy `.template` files → real files (package.json.template → package.json)
2. Replace `__PROJECT_NAME__` placeholder with actual project name
3. Install Shadcn components (npm-installed, not in boilerplate)
4. Fix Sonner next-themes import (Shadcn bug)
5. Run prisma migrate

**Pre-built files that MUST NOT be regenerated (saves ~5000 tokens each run):**
- API: main.ts, app.module.ts, prisma.service.ts, base-crud.service/controller,
  health module, interceptors, filters, DTOs
- Frontend: main.tsx, providers.tsx, router.tsx, layout.tsx, home.tsx,
  api-client.ts, form-utils.ts, query-keys.ts, utils.ts, globals.css,
  use-paginated-query.ts, use-api-mutation.ts, use-debounce.ts, test utils
- Config: vite.config.ts, tailwind.config.ts, postcss.config.js, components.json,
  tsconfig.json (root, frontend, api, shared), vitest.config.ts,
  jest.config.ts, jest.e2e.config.ts, nest-cli.json,
  biome.json, lefthook.yml, docker-compose.yml, .env.example
- Shared: types/job-envelope.ts, constants/job-types.ts

If /setup rewrites ANY of these, it's wasting tokens and risking regressions.

---

## Phase A: Get Runnable

Follow these steps IN ORDER. Ask one section at a time. Wait for user confirmation before proceeding.

### Step 0: Trust But Verify + Install gStack

Before writing any code, help the user verify the repo and install required tools.

**Security scan — "don't trust, verify":**

Tell the user:
> "Before we start, let's verify this repo is safe. Run a quick security scan:"

```bash
# Scan for secrets, credentials, or suspicious content
npx @anthropic-ai/claude-code-security-scanner . 2>/dev/null || echo "Scanner not available — manual review recommended"

# Quick manual checks
grep -r "eval(" --include="*.ts" --include="*.js" . | head -20
grep -r "exec(" --include="*.ts" --include="*.js" . | head -20
grep -rn "password\|secret\|token\|api_key" .env* 2>/dev/null
```

If the security scanner is not available, suggest manual review:
> "No automated scanner found. You can review the repo yourself:
> - Check `scripts/` for anything unexpected
> - Check `.claude/` for suspicious hooks or skills
> - Check `package.json` for unknown dependencies
> - Run `git log --oneline -20` to see recent commit history
>
> When you're satisfied, confirm and we'll continue."

Wait for user confirmation before proceeding.

**Install gStack globally:**

First, check if gStack is already installed globally:

```bash
# Check global install location
ls ~/.claude/skills/gstack/SKILL.md 2>/dev/null && echo "FOUND" || echo "NOT_FOUND"
```

If **FOUND** — skip installation, tell the user:
> "gStack is already installed globally. Skipping installation."

If **NOT_FOUND** — install globally:
```bash
mkdir -p ~/.claude/skills
cd ~/.claude/skills && git clone https://github.com/garrytan/gstack.git && cd gstack && ./setup
```

Tell the user:
> "gStack is now installed globally at `~/.claude/skills/gstack/`. It will be available across all your projects — not just this one. This gives you product planning (/office-hours), code review (/review), QA (/qa), and deployment (/ship) skills."

If the install fails, suggest:
> "gStack install failed. Try manually:
> ```
> mkdir -p ~/.claude/skills
> cd ~/.claude/skills && git clone https://github.com/garrytan/gstack.git && cd gstack && ./setup
> ```
> Or check https://github.com/garrytan/gstack for instructions."

### Step 0.5: Stack Profile

Check whether the user has run `/tech-stack-consult`:

```bash
cat .agstack/stack.json 2>/dev/null || echo "NO_PROFILE"
```

**If `.agstack/stack.json` exists** — load the `profile` field and hold it in
memory for the rest of setup. Tell the user:

> "Using stack profile: `<profile>`. I'll scaffold based on your tech-stack-consult decision."

Valid profiles:
- `nestjs-only` — default, NestJS + BullMQ worker inside NestJS for jobs
- `nestjs-rust` — NestJS + separate Rust worker for CPU-heavy jobs
- `go-only` — frontend only; remove /api, /jobs, /shared. User writes Go backend.
- `python-only` — frontend only; remove /api, /jobs, /shared. User writes Python backend.

**If it doesn't exist** — surface the tradeoff:

> "No stack profile found. /setup will default to `nestjs-only` (NestJS + BullMQ
> worker — no Rust). This is the simplest full-stack option: 1 Node runtime,
> 1 Dockerfile, 1 CI pipeline.
>
> Options:
> 1. Run `/tech-stack-consult` first (5 questions, ~2 min) to evaluate all profiles, then re-run `/setup`
> 2. Proceed with `nestjs-only` default
>
> Which do you want?"

Wait for user response. If they pick (1), stop the skill and ask them to run
`/tech-stack-consult`. If they pick (2), set `profile = "nestjs-only"` in memory
and continue.

Record the active profile in the session — you'll apply it in Step 2.5.

### Step 1: Project Identity

Ask the user:
- Project name (kebab-case, for package.json)
- One-line description (what does this product do?)
- Team mode: **Solo** (1 dev + AI agents) or **Team** (multiple devs + AI agents)?

Then update `CLAUDE.md`:
- Replace `## Team Mode: [solo | team]` with the user's choice
- If **Team**: `main` branch will be protected, PRs required, file claims enabled
- If **Solo**: lightweight workflow, direct push to main OK

Then:
1. Update `CLAUDE.md` — replace `[Project Name]` with actual name, replace `[Brief description]` with actual description

2. **Create package.json files from templates (DO NOT write from scratch):**
   The boilerplate ships `.template` files with ALL versions already pinned.
   You only need to copy and replace `__PROJECT_NAME__`:

   ```bash
   # Copy templates → real files
   cp package.json.template package.json
   cp frontend/package.json.template frontend/package.json
   cp api/package.json.template api/package.json

   # Replace project name placeholder in all three
   sed -i "s/__PROJECT_NAME__/<actual-project-name>/g" package.json frontend/package.json api/package.json
   ```

   That's it. All dependency versions are pre-resolved and tested in the templates.
   DO NOT run `npm view` or change any version numbers.
   Version upgrades are managed centrally through agStack releases.

3. **Create shared/package.json** (no template needed — it's tiny):
   ```json
   {
     "name": "<project-name>-shared",
     "version": "0.1.0",
     "private": true,
     "main": "./types/index.ts",
     "types": "./types/index.ts"
   }
   ```

4. **Set up .env:**
   `.env.example` and `docker-compose.yml` already exist with `__PROJECT_NAME__` placeholder.
   Replace it:
   ```bash
   sed -i "s/__PROJECT_NAME__/<actual-project-name>/g" .env.example docker-compose.yml \
     frontend/index.html frontend/src/app/layout.tsx frontend/src/pages/home.tsx
   ```
   Then auto-copy `.env.example` → `.env` if `.env` does not exist.

5. Tell the user: "`.env` has been created with dev defaults. Review and adjust if needed, then confirm when ready."
   Wait for user confirmation before proceeding.

6. Run `npm install` from root to link workspaces and install all dependencies.

### Step 2: Infrastructure

**All infrastructure files are pre-existing in the boilerplate. Verify — do NOT regenerate:**

1. `docker-compose.yml` — ALREADY EXISTS. Reads `POSTGRES_DB` from `.env`.
   DO NOT regenerate. Only verify it's present.

2. `api/prisma/schema.prisma` — ALREADY EXISTS (empty, no models yet).
   DO NOT regenerate. Domain models come from sprint tasks in Phase B.

   **Prisma 7+ compatibility (only if template pinning failed):** After `npm install`,
   check `npx prisma --version`. If somehow Prisma 7+ got installed:
   a. Remove `url` line from `datasource db {}` in schema.prisma
   b. Create `api/prisma/prisma.config.ts` with `defineConfig` pointing to env DATABASE_URL
   c. Add `output = "../node_modules/.prisma/client"` to `generator client {}`
   If Prisma 6 (expected) — no changes needed.

3. `frontend/vite.config.ts` — ALREADY EXISTS with `@` and `@shared` resolve aliases.
   `frontend/tailwind.config.ts`, `postcss.config.js`, `components.json` — ALL pre-existing.
   DO NOT regenerate any of these.

Before running docker, check for port conflicts:
```bash
lsof -i :5432 2>/dev/null | head -5    # check if postgres port is in use
lsof -i :6379 2>/dev/null | head -5    # check if redis port is in use
```

If ports are in use, warn the user:
> "Port 5432 (or 6379) is already in use — you may have a local postgres/redis running. Either stop it or change the port in `.env` and `docker-compose.yml`."

Then ask user to run:
```bash
docker-compose up -d
docker compose ps                       # verify both services are running

# Prisma reads .env from its own directory (api/), but .env lives at root.
# Symlink it so Prisma can find DATABASE_URL:
cd api && ln -sf ../.env .env

npx prisma migrate dev --name init      # from api/ folder
```

If prisma migrate fails, check:
1. `P1012: Environment variable not found: DATABASE_URL`?
   → Prisma reads `.env` from `api/`, not root. Symlink: `cd api && ln -sf ../.env .env`
2. Is `.env` present in root? (`cp .env.example .env` if not)
3. Does DATABASE_URL in `.env` match docker-compose credentials?
4. Is postgres actually ready? (`docker compose logs postgres | tail -5`)
4. Prisma 7 error "datasource property `url` is no longer supported"?
   → Follow the Prisma 7 compatibility steps above (remove url from schema, create prisma.config.ts)

### Step 2.5: Apply Stack Profile

Now apply the profile chosen in Step 0.5. This adjusts the scaffold BEFORE
installing npm deps for frontend/api, so nothing that depends on the removed
parts gets installed.

**If profile == `nestjs-only`** — this is the default. No `/jobs` folder exists
in the repo, so there's nothing to remove. Just set up the BullMQ worker:

Tell the user:
> "Applying `nestjs-only` profile (default): setting up BullMQ worker inside NestJS."

Then:

1. Copy the BullMQ worker template into the NestJS app:
   ```bash
   cp -r templates/worker-bullmq/src/workers api/src/workers
   ```

   Then register `WorkersModule` in `AppModule`. The user can follow the
   `typescript-nestjs` skill's BullMQ section to add real processors.

2. Remove Rust-specific env vars from `.env.example` and `.env` (if present):
   - `RUST_LOG`
   - `WORKER_CONCURRENCY`

3. Update `CLAUDE.md` Project Structure: remove the `- /jobs` line if present.

**If profile == `nestjs-rust`:**

Tell the user:
> "Applying `nestjs-rust` profile: copying Rust worker from templates."

Then:

1. Copy the Rust worker template to project root:
   ```bash
   cp -r templates/jobs-rust jobs
   ```

2. Add Rust-specific env vars to `.env` and `.env.example` (if not already present):
   - `RUST_LOG=info`
   - `WORKER_CONCURRENCY=4`

3. Add a `jobs:` service to `docker-compose.yml` if not already present
   (build from `jobs/`, depends on redis + postgres).

4. Verify Rust toolchain is installed:
   ```bash
   rustc --version || echo "Rust not installed — run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
   ```

**If profile == `go-only` OR `python-only`:**

The team is not writing a NestJS backend. agStack ships the React frontend;
you own the backend in Go or Python.

Let `LANG` = "Go" if profile == `go-only`, otherwise "Python".
Let `WORKDIR` = `backend-go` if profile == `go-only`, otherwise `backend-python`.

Tell the user:
> "Applying `<profile>` profile: keeping /frontend only. Removing /api (NestJS),
> /jobs (Rust), and /shared (TS types) — you'll write your backend in <LANG>.
> I'll leave a README in `<WORKDIR>/` with the suggested layout."

Then:

1. Remove TS-backend folders:
   ```bash
   rm -rf api/ jobs/ shared/
   ```

2. Remove TS-backend references from `docker-compose.yml`:
   - Delete the `jobs:` service (if present)
   - Keep `postgres:` and `redis:` — user's backend will use them
   - Do NOT add a service for the user's backend — they run it outside Docker
     until they decide how to package it.

3. Remove TS-backend env vars from `.env.example` and `.env`:
   - `JWT_SECRET`, `JWT_EXPIRES_IN` (NestJS-specific)
   - `RUST_LOG`, `WORKER_CONCURRENCY`
   - KEEP `DATABASE_URL` and `REDIS_URL` — user's backend needs these

4. Create `<WORKDIR>/README.md` with a suggested layout. Use exactly this template:

   For `go-only` (`backend-go/README.md`):
   ```markdown
   # Backend (Go)

   agStack provides the React frontend. You own this Go backend.

   ## Suggested layout
   - `cmd/api/main.go` — HTTP server entry point
   - `internal/handlers/` — HTTP handlers
   - `internal/models/` — domain types
   - `internal/db/` — Postgres access (pgx or sqlx)
   - `internal/queue/` — Redis queue consumer (optional)

   ## Suggested libraries
   - Router: chi, gin, or net/http
   - DB: pgx or sqlx
   - Queue: asynq (Redis-backed job queue — matches frontend expectations)

   ## Frontend integration
   The frontend expects `VITE_API_URL` (see `frontend/.env`) to point at this
   service. Default: `http://localhost:3000/api/v1`.

   ## Docker
   `docker-compose.yml` in the repo root provides Postgres + Redis. Run:
   ```
   docker-compose up -d
   ```
   Then start your Go service separately on port 3000 (or change `VITE_API_URL`).
   ```

   For `python-only` (`backend-python/README.md`):
   ```markdown
   # Backend (Python)

   agStack provides the React frontend. You own this Python backend.

   ## Suggested layout
   - `app/main.py` — FastAPI/Django entry point
   - `app/routers/` or `app/views/` — HTTP routes
   - `app/models/` — Pydantic / Django models
   - `app/db/` — Postgres access (SQLAlchemy / Django ORM)
   - `app/workers/` — Celery / RQ / Dramatiq tasks (optional)

   ## Suggested stacks
   - FastAPI + SQLAlchemy + Celery
   - Django + Django REST + RQ

   ## Frontend integration
   The frontend expects `VITE_API_URL` (see `frontend/.env`) to point at this
   service. Default: `http://localhost:3000/api/v1`.

   ## Docker
   `docker-compose.yml` in the repo root provides Postgres + Redis. Run:
   ```
   docker-compose up -d
   ```
   Then start your Python service separately on port 3000 (or change `VITE_API_URL`).
   ```

5. Update `frontend/.env` (or `.env.example` for frontend) so `VITE_API_URL`
   is clearly a placeholder — prepend a comment:
   ```
   # Your <LANG> backend URL. agStack does not scaffold this backend.
   VITE_API_URL=http://localhost:3000/api/v1
   ```

6. Update `CLAUDE.md` — major surgery since the TS backend is gone:
   - Delete the `### Backend API (/api)` subsection from `## Tech Stack`
   - Delete the `### Job Worker (/jobs)` subsection from `## Tech Stack`
   - In `## Project Structure`:
     - Delete `- /api`, `- /jobs`, `- /shared` bullets
     - Add `- /<WORKDIR> — YOUR <LANG> backend (not scaffolded by agStack)`
   - Delete the `### Backend NestJS` section from `## Coding Conventions`
   - Delete the `### Backend NestJS — Shared Code Map` table
   - Delete the `### Rust Jobs — Shared Code Map` table
   - Delete the `### Rust Jobs (/jobs)` section
   - Delete the `## API Conventions` section (user defines their own)
   - Delete the `## Job Queue Conventions` section
   - In `## Multi-Agent Rules` → `Spawn order`: note that `agent-api` and
     `agent-jobs` do not apply here
   - In `## Key Decisions`: delete references to ADR 002 (Rust) and leave a note
     pointing to `docs/decisions/000-tech-stack.md`
   - Leave `.claude/agents/agent-api.md` and `agent-jobs.md` on disk (inert)
     but add a line at the top of CLAUDE.md's agents section:
     ```
     > Note: agent-api and agent-jobs are disabled for this project (non-TS backend).
     ```

7. Scaffold step — after removing everything, the repo still needs to be
   runnable for frontend-only development. Run the frontend npm install
   ONLY (skip api/jobs steps below in later /setup sections):

   ```bash
   cd frontend && npm install
   ```

   Then install backend dependencies for the user's stack:
   - `go-only`: `cd backend-go && go mod tidy` (generates go.sum)
   - `python-only`: `cd backend-python && pip install -e ".[dev]"`

   Do NOT run `npx prisma migrate` or any NestJS-related steps — they no
   longer apply. Skip Step 2's Prisma section entirely if profile is
   `go-only` or `python-only`.

Flag for the user:
> "Your backend is OUT OF SCOPE for agStack skills — /review, /qa, /ship
> assume a NestJS API. Those skills will still work for the frontend, but
> any backend QA/review is on you."

After applying the profile, run `git status` and show the user what changed
before continuing to Step 3.

### Step 3: App Shell + Shadcn Components

**EVERYTHING below is pre-existing in the boilerplate. DO NOT regenerate ANY of these files:**

Backend (all pre-built):
- `api/src/main.ts` — NestJS bootstrap with Swagger, CORS, global pipes/filters
- `api/src/app.module.ts` — Root module importing HealthModule
- `api/src/common/prisma.service.ts` — NestJS-managed PrismaClient
- `api/nest-cli.json` — NestJS CLI config
- All common infrastructure, health module, DTOs, filters, interceptors

Frontend (all pre-built):
- `frontend/index.html` — Vite entry HTML (has `__PROJECT_NAME__` in title)
- `frontend/src/app/main.tsx` — React entry point
- `frontend/src/app/providers.tsx` — QueryClient provider
- `frontend/src/app/router.tsx` — React Router (home + 404)
- `frontend/src/app/layout.tsx` — Layout shell (has `__PROJECT_NAME__` in header)
- `frontend/src/pages/home.tsx` — Home page (has `__PROJECT_NAME__` in heading)
- `frontend/src/lib/utils.ts` — Shadcn cn() utility
- `frontend/src/styles/globals.css` — Tailwind base + CSS variables
- `frontend/src/lib/form-utils.ts`, `api-client.ts`, all hooks, all features

**The ONLY things /setup does here are:**

(`__PROJECT_NAME__` replacement is already done in Step 1 via the sed command.)

1. **Install Shadcn components** (these are npm-installed, not in boilerplate):
   ```bash
   cd frontend && npx shadcn@latest add button input label separator sonner
   ```

2. **Fix Sonner component** — Shadcn's default `sonner.tsx` imports `useTheme` from `next-themes`
   which does NOT exist in Vite projects. After installing, edit `frontend/src/components/ui/sonner.tsx`:
   - Remove the `import { useTheme } from "next-themes"` line
   - Remove the `const { theme = "system" } = useTheme()` line
   - Replace `theme={theme as ToasterProps["theme"]}` with `theme="light"`
   This is a known Shadcn issue — their default template assumes Next.js.

3. **Run `bash scripts/sync-components.sh`** to update COMPONENTS.md

Ask user to run `npm run dev` and verify both frontend (:5173) and API (:3000) are working.

### Step 4: Verify & Hand Off

Once everything runs:
1. Run `npx @biomejs/biome check .` to verify code quality
2. Run TypeScript typecheck on frontend + api
3. Summarize what's been set up

Then tell the user (in their preferred language):

> **Setup complete! Project is up and running.**
>
> If you have existing research, prototypes, or reference code, drop them in the `materials/` folder now.
> Claude will review them during `/office-hours` so you don't have to explain everything from scratch.
>
> Next step: run `/office-hours` to plan your product.
> gStack will scan `materials/` and ask about your product vision, target users, and core features,
> then generate a PRD. From there:
>
> `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` → **`/plan-sprint`**
>
> `/plan-sprint` converts your eng review into Epics, Tasks, and a Sprint backlog
> so Claude knows exactly what to build and in what order.
>
> Useful gStack skills:
> - `/office-hours` — define product, create PRD
> - `/plan-eng-review` — validate architecture
> - `/plan-sprint` — create epics, tasks, sprint backlog
> - `/design-consultation` — discuss UX/UI approach
> - `/review` → `/qa` → `/ship` — daily dev workflow

---

## Phase B: Build Product (via gStack)

Phase B is NOT part of this skill. It happens organically through gStack skills.
But here's the expected flow for reference:

```
/office-hours          → Define product, create PRD
/plan-ceo-review       → Validate product direction
/plan-eng-review       → Validate architecture for the features planned
/plan-sprint           → Create Epics + Tasks in BACKLOG.md, populate SPRINT.md
/plan-design-review    → Validate UX approach
```

Then sprint by sprint:
```
code feature           → Follow patterns in skills (typescript-nestjs, frontend-ui)
/review                → Code review
/qa                    → Test
/ship                  → Ship to staging/production
/retro                 → Sprint retrospective
```

### Common product decisions handled in Phase B

These are decisions that `/office-hours` and sprint planning will resolve:

| Decision | Depends on product | NOT in /setup |
|----------|-------------------|---------------|
| Auth (yes/no, method) | Blog = no auth. SaaS = JWT. Internal tool = SSO | `/office-hours` decides |
| Database schema | Based on PRD entities | Sprint task |
| App layout (sidebar/nav) | Admin panel = sidebar. Landing = top nav. Dashboard = both | `/design-consultation` decides |
| Roles & permissions | Some MVPs have none. SaaS = admin/user. Marketplace = buyer/seller | `/office-hours` decides |
| Deploy target | Depends on budget, scale, team | `/setup-deploy` handles when ready |
| Background jobs runner | Driven by stack profile (see `.agstack/stack.json`) | `/tech-stack-consult` decides |

---

## gStack Integration

Use gStack skills throughout the process:

| Situation | gStack skill | Why |
|-----------|-------------|-----|
| Something fails during setup | `/investigate` | Debug with full context |
| Need to research a library | `/browse` | Web browsing (NEVER use mcp__claude-in-chrome__* tools) |
| Generating security-critical code | `/careful` | Extra review and caution |
| Code review after generating | `/review` | Validate quality |
| Ready to test | `/qa` | Full test suite |
| Ready to ship | `/ship` or `/land-and-deploy` | Deploy flow |
| After all features done | `/document-release` | Auto-generate docs |

---

## Rules for this skill

1. ALWAYS ask ONE section at a time. Never dump all questions at once.
2. After generating files, ALWAYS ask user to verify they work before proceeding.
3. If something fails, use `/investigate` to debug, then fix before moving on.
4. Communicate in the user's preferred language. All generated code, comments, and docs MUST be in English.
5. Reference existing conventions — don't invent new patterns.
6. If user says "skip" for any step, skip it and move to next.
7. Phase A should be FAST — max 4 steps to a running dev server.
8. DO NOT make product decisions (auth, schema, layout) — that's Phase B via `/office-hours`.
9. DO NOT generate business features — real features come from sprint plan. Skills teach the patterns.
