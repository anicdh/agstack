# agStack

**The full-stack starter kit built for Claude MAX users who ship, not tinker.**

<!-- Uncomment when repo is public:
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
-->

You get a **senior-level AI teammate from day one**. Not a blank project with a README — a codebase where Claude already knows the architecture, the coding conventions, and exactly which components to use. Every pattern is demonstrated through a living reference module that Claude learns from, then cleanly removes when you're ready to build.

## Why agStack?

**Production-ready stack** — React frontend with your choice of backend: NestJS with BullMQ (default), NestJS + Rust workers, Go, or Python. All profiles share PostgreSQL + Redis and are architected to scale so you never have to rip things apart when your MVP gets traction. Every tech choice is documented with a decision record explaining *why*, not just *what*.

**Real product development workflow** — from first idea through deploy. Guided onboarding gets you running in minutes. Then structured product thinking (inspired by YC and Agile) takes you from problem definition to shipped features, with built-in review gates at every stage.

**UX that doesn't suck** — because no one talks about this for AI-assisted development. A concrete design system with actionable rules (not abstract theory), a component decision map that prevents Claude from writing janky raw HTML, and interactive UI patterns baked into every reference.

**From idea to deploy. One repo. One AI. Ship it.**

## Tech Stack

Run `/tech-stack-consult` to pick the right profile for your project (5 questions, ~2 min).

| Profile | Frontend | Backend | Jobs | Best for |
|---------|----------|---------|------|----------|
| `nestjs-only` (default) | React 18 + Vite + Tailwind + Shadcn/ui | NestJS + Prisma | BullMQ (in NestJS) | Most projects — simplest deploy |
| `nestjs-rust` | Same | NestJS + Prisma | Rust + Tokio | CPU-heavy jobs, team knows Rust |
| `go-only` | Same | Go (Chi + pgx) | asynq (Redis) | Team prefers Go |
| `python-only` | Same | Python (FastAPI + SQLAlchemy) | Celery (Redis) | Team prefers Python |

All profiles share: PostgreSQL 16, Redis 7, Biome (lint/format), Lefthook (git hooks), strict TypeScript for frontend.

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with Claude MAX subscription
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Node.js 20+
- Rust toolchain (`rustup`) — only if using `nestjs-rust` profile
- Go 1.22+ — only if using `go-only` profile
- Python 3.12+ — only if using `python-only` profile

### Setup

Create your project folder, open Claude Code inside it, and paste this:

```
git clone https://github.com/anicdh/agstack.git _tmp && cp -r _tmp/. . && rm -rf _tmp .git && git init && git add -A && git commit -m "init: scaffold from agStack" then read .claude/skills/setup/SKILL.md and follow its instructions
```

Claude does the rest — installs dependencies, starts Docker, runs migrations, and gets your dev servers running.

`/setup` walks you through the full onboarding:

0. **Verify + install gStack** — security scan the repo, install gStack product workflow skills
0.5. **Stack profile** — reads `.agstack/stack.json` (from `/tech-stack-consult`) to determine which backend to scaffold
1. **Project identity** — name, description, generates package.json and config files
2. **Infrastructure** — Docker Compose up, database ready, .env configured
2.5. **Apply profile** — removes unused stacks (e.g., `/jobs` for nestjs-only, `/api` + `/jobs` for go-only/python-only)
3. **App shell** — entry points, routing, providers, dev servers verified
4. **Hand off** — health check verified, ready for product decisions

Then use `/office-hours` to start building your actual product — define your users, plan features, design your schema, and kick off your first sprint.

### Upgrade existing project

Already have a project built on agStack? Pull the latest conventions, agent rules, and skills:

```
Read .claude/skills/upgrade/SKILL.md and follow its instructions
```

This updates boilerplate files (CLAUDE.md, agent configs, Definition of Done, skills) while preserving your project code, sprint history, and custom configs.

### Manual Setup (without the wizard)

```bash
# 1. Environment — copy and edit if needed (defaults work out of the box)
cp .env.example .env

# 2. Infrastructure — start postgres + redis
docker-compose up -d

# 3. Verify database is ready (wait a few seconds for postgres to start)
docker compose ps                   # both should show "running"

# 4. Run services (depends on your profile)

# nestjs-only (default):
cd api && npm install && npx prisma migrate dev --name init && npm run start:dev    # terminal 1
cd frontend && npm install && npm run dev                                           # terminal 2

# nestjs-rust (adds Rust worker):
cd api && npm install && npx prisma migrate dev --name init && npm run start:dev    # terminal 1
cd frontend && npm install && npm run dev                                           # terminal 2
cd jobs && cargo build && cargo run                                                 # terminal 3

# go-only:
cd backend-go && go run ./cmd/api                                                  # terminal 1
cd frontend && npm install && npm run dev                                           # terminal 2

# python-only:
cd backend-python && pip install -e . && uvicorn app.main:app --reload             # terminal 1
cd frontend && npm install && npm run dev                                           # terminal 2
```

> **Troubleshooting:** If `prisma migrate` fails with "User was denied access", your local port 5432 may already be in use by another postgres instance. Either stop it (`brew services stop postgresql`) or change the port in `.env` and `docker-compose.yml`.

## How It Works

agStack is more than scaffolding. It teaches Claude how to be a senior developer on *your* project.

```
CLAUDE.md              → Coding conventions, reuse map, quality rules
docs/ux-guide.md       → UX principles tied to concrete UI decisions
COMPONENTS.md          → Shadcn component catalog with decision map
Skills (typescript-nestjs, frontend-ui, etc.) → Teach agents patterns directly
docs/decisions/*.md    → Architecture Decision Records (ADRs)
```

When Claude builds a new feature, it reads these files first — so it uses the right components, follows your patterns, and writes code that matches the rest of the codebase.

## Project Structure

```
├── frontend/          React SPA (Vite dev server :5173)
├── api/               NestJS REST API (:3000) — nestjs-rust / nestjs-only profiles
├── jobs/              Rust async job worker — nestjs-rust profile only
├── shared/            Shared TypeScript types & Zod schemas — NestJS profiles only
├── templates/         Starter templates for Go, Python, BullMQ worker
├── materials/         Your existing research, prototypes, reference code (local only, gitignored)
├── agile/             Backlog, sprints, velocity tracking
├── docs/              PRD, UX guide, API docs, ADRs
├── scripts/           Setup and maintenance scripts
├── .claude/           Claude Code config, skills, agents
└── infra/             Dockerfiles, deploy scripts
```

For `go-only` profile, `/setup` removes `/api`, `/jobs`, `/shared` and creates `backend-go/` from the Go template. For `python-only`, it creates `backend-python/` instead. You own the backend — agStack provides the React frontend and the product workflow.

## Why gStack + Agile?

agStack combines two things that most AI coding setups completely ignore: a **structured product workflow** (gStack) and a **proven iteration framework** (Agile). Here's why both matter — and what breaks when you skip one.

**gStack** is a set of Claude Code skills created by Garry Tan (YC) that guide you through product thinking — defining your users, shaping features, reviewing architecture, and shipping with quality gates. Without it, you're just telling Claude "build me X" with no product context. Claude writes code fast, but code without product direction is just organized waste. gStack provides the *what* and *why* before you start building.

**Agile** (specifically 1-week sprints) gives you the rhythm: ship every Monday, get real user feedback by Thursday, adjust course, repeat. Without it, AI-assisted development drifts — you build for 3 weeks straight, ship a big bang release, and discover half of it doesn't match what users actually need. Short sprints force you to prioritize ruthlessly and validate constantly.

**Together**, they close the loop that neither can close alone. gStack tells Claude what to build and why. Agile tells Claude when to stop building and start listening. The combination means you're never more than 4 days away from real user input, and every sprint starts with actual feedback instead of assumptions.

**Without gStack** — Claude writes code without product context. You get features nobody asked for, architecture decisions made on vibes, and no quality gates before shipping. You move fast but in the wrong direction.

**Without Agile** — You have great product thinking but no shipping discipline. Features pile up in branches, feedback comes too late, and you spend more time planning than building. The AI works hard but nothing reaches users.

agStack wires them together so the default workflow is: think (gStack) → build (Claude) → ship (Monday) → listen (Thursday) → repeat.

## Development Workflow

agStack integrates with [gStack](https://github.com/garrytan/gstack) for a structured AI-assisted development workflow:

```
Product Discovery:   /office-hours → define users, problems, features
Sprint Planning:     /plan-ceo-review → /plan-eng-review → /plan-sprint
Daily Development:   code → /review → /qa → /ship
Sprint End:          sprint review → /retro → /plan-sprint (next)
```

### Weekly Sprint Playbook

Each sprint is 1 week. Ship fast, get feedback, iterate.

```
Monday       Ship → deploy sprint work + hotfixes to users
             /qa full → /ship → /land-and-deploy
             Start coding next sprint immediately after deploy

Tuesday      Build → heads-down development
Wednesday    Build → continue development, /review as you go

Thursday     Sprint Review + Retro + Planning (in this order)
             1. Sprint Review → collect user feedback on this week's release
             2. /retro → what worked, what didn't, lessons learned
             3. /plan-sprint → next sprint from backlog + feedback + retro lessons
             Identify critical hotfixes that must ship Monday

Friday       Hotfix + QA → fix ONLY critical issues (bugs, UX blockers)
             New feature ideas from feedback → backlog, NOT this Friday
             /qa → test everything for Monday's release
```

Monday's release includes both sprint features and critical hotfixes from Friday. Thursday is the only ceremony day — review first (what did users think?), retro second (how did we work?), planning last (what's next?). The rest of the week is pure building and shipping.

### Development Modes

When `/plan-sprint` creates your sprint, you choose how to work:

**Standard Mode** (recommended) — one branch per task, one PR per task. Blocker tasks run sequentially first. Once blockers are merged, independent tasks fan out in parallel via git worktrees (each agent gets its own isolated directory, zero conflicts). Declare dependencies with `blocked_by:` in the sprint backlog and the wave calculation handles the rest. Small PRs, clean history, and parallel speed where it's safe.

**Hero Mode** — one branch per sprint, multiple agents grinding simultaneously. All agents commit on the same branch, staying in their file ownership lanes. When an agent finishes early, it picks up independent tasks. One big PR at the end of the sprint. Faster, but you need to be comfortable reviewing a larger diff.

Pick Standard for most sprints (it now supports parallelism where tasks are independent). Pick Hero when all tasks are independent and you want a single branch.

## Scripts

| Command | Description |
|---------|-------------|
| `bash scripts/sync-components.sh` | Auto-update COMPONENTS.md after installing new Shadcn components |

## Documentation

| Doc | What it covers |
|-----|---------------|
| [Architecture](ARCHITECTURE.md) | System design, data flow, infrastructure |
| [UX Design Guide](docs/ux-guide.md) | Actionable UX rules based on Laws of UX |
| [Component Catalog](frontend/src/components/ui/COMPONENTS.md) | Shadcn component decision map |
| [Architecture Decisions](docs/decisions/) | ADRs for every major tech choice |
| Swagger UI | `http://localhost:3000/api/docs` (when API is running) |

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using [conventional commits](https://www.conventionalcommits.org/)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Star History

If agStack helps you ship faster, consider giving it a star. It helps others discover the project.

---

Built for makers who ship. Powered by Claude.
