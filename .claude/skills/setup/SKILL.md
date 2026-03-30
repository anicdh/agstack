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

**IMPORTANT — DO NOT regenerate boilerplate code:**
The starter kit already ships with ALL reference code pre-built and tested:
- Dummies module (API: controller, service, DTOs, tests)
- Dummies feature (Frontend: components, queries, types, tests)
- Common infrastructure (BaseCrudService, BaseCrudController, PrismaService,
  hooks, api-client, query-keys, interceptors, filters)
- Shared types (shared/types/dummy.ts)
- Prisma schema (api/prisma/schema.prisma with Dummy model)

DO NOT rewrite, regenerate, or modify these files during /setup.
They are already TypeScript-strict compliant and tested.
Setup should ONLY generate project-specific files: package.json, .env,
vite config, tailwind config, and the minimal app shell (main.tsx, router, layout).

All generated code MUST follow the conventions in CLAUDE.md, including:
- TypeScript maximum strict mode (exactOptionalPropertyTypes, noImplicitOverride, etc.)
- Biome linting rules

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

### Step 1: Project Identity

Ask the user:
- Project name (kebab-case, for package.json)
- One-line description (what does this product do?)

Then:
1. Update `CLAUDE.md` — replace `[Project Name]` with actual name, replace `[Brief description]` with actual description
2. Generate root `package.json` with project name and scripts:
   **CRITICAL — npm workspaces:**
   The root package.json MUST include a `workspaces` field so `npm run dev -w api`
   and `npm run dev -w frontend` work correctly:
   ```json
   {
     "name": "<project-name>",
     "private": true,
     "workspaces": ["frontend", "api", "shared"],
     "scripts": { ... }
   }
   ```
   Without `"workspaces"`, `npm -w api` will fail with "No workspaces found".

   Scripts:
   - `dev` — run all services (concurrently: `concurrently \"npm run dev -w api\" \"npm run dev -w frontend\"`)
   - `build` — build all
   - `test` — run all tests
   - `lint` — biome check
   - `typecheck` — tsc --noEmit for frontend + api
   - `scaffold:clean` — bash scripts/scaffold-clean.sh
   - `scaffold:generate` — bash scripts/scaffold-generate.sh
   - `sync:components` — bash scripts/sync-components.sh

   After generating root package.json, run `npm install` from root to link workspaces.
3. Generate `frontend/package.json` with dependencies:
   - react, react-dom, react-router-dom
   - @tanstack/react-query, zustand
   - zod, react-hook-form, @hookform/resolvers
   - tailwindcss, tailwind-merge, clsx, class-variance-authority
   - lucide-react
   - vite, typescript (devDeps)
   - vitest, @testing-library/react, @testing-library/jest-dom (devDeps)
   - Scripts: dev, build, preview, test, test:watch, typecheck, lint

   **CRITICAL — Version pinning:**
   DO NOT hardcode version numbers. Instead, use `"*"` for all dependencies,
   then IMMEDIATELY run `npm install` which will resolve to latest compatible versions,
   and commit the resulting package-lock.json. Alternatively, before writing package.json,
   run `npm view <package-name> version` for each dependency to get the REAL latest version.
   NEVER guess or hallucinate version numbers — this causes ETARGET install failures.

4. Generate `api/package.json` with dependencies:
   - @nestjs/core, @nestjs/common, @nestjs/platform-express
   - @nestjs/swagger, @nestjs/passport, passport-jwt
   - @prisma/client, prisma (devDep)
   - class-validator, class-transformer
   - bullmq
   - Scripts: dev (start:dev), build, start:prod, test, test:e2e, typecheck, lint
   - Also generate `api/nest-cli.json`
   - Same version pinning rule as frontend: use `"*"` or `npm view` first.
5. Generate `shared/package.json` for workspace module resolution:
   ```json
   {
     "name": "<project-name>-shared",
     "version": "0.1.0",
     "private": true,
     "main": "./types/index.ts",
     "types": "./types/index.ts"
   }
   ```
6. Generate `.env.example` — single source of truth for ALL env vars (docker + app).
   Required vars with sensible dev defaults:
   ```
   # Docker + Database
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=<project-name>
   DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}

   # Docker + Redis
   REDIS_URL=redis://localhost:6379

   # Auth
   JWT_SECRET=change-me-in-production
   JWT_EXPIRES_IN=15m

   # API
   PORT=3000

   # Frontend
   VITE_API_URL=http://localhost:3000/api/v1
   VITE_APP_ENV=development
   ```
7. Auto-copy `.env.example` → `.env` if `.env` does not exist
8. Tell the user: "`.env` has been created with dev defaults. Review and adjust if needed, then confirm when ready."
   Wait for user confirmation before proceeding.

Ask user to run `npm install` in both frontend/ and api/ to confirm dependencies install correctly.

### Step 2: Infrastructure

Generate WITHOUT asking (every project needs these):

1. `docker-compose.yml` — reads variables from `.env` file:
   ```yaml
   services:
     postgres:
       image: postgres:16
       environment:
         POSTGRES_USER: ${POSTGRES_USER}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
         POSTGRES_DB: ${POSTGRES_DB}
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
     redis:
       image: redis:7-alpine
       ports:
         - "6379:6379"
   volumes:
     postgres_data:
   ```
   This means `docker-compose up -d` works IMMEDIATELY after clone. No .env needed for docker.
   The `.env` file is only used by the app code (api, frontend) to CONNECT to these docker services.

2. `api/prisma/schema.prisma` — ALREADY EXISTS in boilerplate with Dummy model.
   DO NOT regenerate. Only verify it's present. NO User model yet — that's Phase B.
3. Vite config, Tailwind config, Shadcn init if not already present
   - Vite config MUST include `@shared` resolve alias: `{ "@shared": path.resolve(__dirname, "../shared") }`
   - This matches the `@shared/*` path alias in `frontend/tsconfig.json`

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
npx prisma migrate dev --name init      # from api/ folder
```

If prisma migrate fails, check:
1. Is `.env` present in root? (`cp .env.example .env` if not)
2. Does DATABASE_URL in `.env` match docker-compose credentials?
3. Is postgres actually ready? (`docker compose logs postgres | tail -5`)

### Step 3: App Shell (Minimal)

**Pre-existing files from boilerplate (DO NOT regenerate):**
All Dummies reference code, common infrastructure (base classes, hooks, api-client,
interceptors, filters), shared types, and Prisma schema are ALREADY in the repo.
Do NOT rewrite them — they are tested and TypeScript-strict compliant.

**Only generate these NEW project-specific files:**
1. Install base Shadcn components:
   ```bash
   npx shadcn@latest add button input label separator sonner
   ```
2. **Fix Sonner component** — Shadcn's default `sonner.tsx` imports `useTheme` from `next-themes`
   which does NOT exist in Vite projects. After installing, edit `frontend/src/components/ui/sonner.tsx`:
   - Remove the `import { useTheme } from "next-themes"` line
   - Remove the `const { theme = "system" } = useTheme()` line
   - Replace `theme={theme as ToasterProps["theme"]}` with `theme="light"`
   This is a known Shadcn issue — their default template assumes Next.js.
3. Run `bash scripts/sync-components.sh` to update COMPONENTS.md
4. Generate ONLY these app shell files (everything else already exists):
   - `frontend/index.html` — Vite entry HTML
   - `frontend/src/app/main.tsx` — React entry point
   - `frontend/src/app/providers.tsx` — QueryClient provider (NO auth yet)
   - `frontend/src/app/router.tsx` — basic React Router (just home page + 404)
   - `frontend/src/app/layout.tsx` — minimal layout (header + content area, NO sidebar yet)
   - `frontend/src/pages/home.tsx` — placeholder home page with project name
   - `api/src/main.ts` — NestJS entry point (bootstrap, Swagger, global pipes/filters)
   - `api/src/app.module.ts` — Root module importing DummiesModule

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
code feature           → Follow Dummies reference pattern
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
| Background jobs (Rust) | Not every MVP needs jobs | Sprint task if needed |

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
9. DO NOT generate features beyond the Dummies reference — real features come from sprint plan.
