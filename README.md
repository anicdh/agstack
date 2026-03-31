# agStack

**The full-stack starter kit built for Claude MAX users who ship, not tinker.**

<!-- Uncomment when repo is public:
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
-->

You get a **senior-level AI teammate from day one**. Not a blank project with a README — a codebase where Claude already knows the architecture, the coding conventions, and exactly which components to use. Every pattern is demonstrated through a living reference module that Claude learns from, then cleanly removes when you're ready to build.

## Why agStack?

**Production-ready stack** — React + NestJS + Rust workers + PostgreSQL + Redis — architected to scale so you never have to rip things apart when your MVP gets traction. Every tech choice is documented with a decision record explaining *why*, not just *what*.

**Real product development workflow** — from first idea through deploy. Guided onboarding gets you running in minutes. Then structured product thinking (inspired by YC and Agile) takes you from problem definition to shipped features, with built-in review gates at every stage.

**UX that doesn't suck** — because no one talks about this for AI-assisted development. A concrete design system with actionable rules (not abstract theory), a component decision map that prevents Claude from writing janky raw HTML, and interactive UI patterns baked into every reference.

**From idea to deploy. One repo. One AI. Ship it.**

## Tech Stack

| Layer    | Tech                                               |
|----------|----------------------------------------------------|
| Frontend | React 18 + Vite + Tailwind + Shadcn/ui + Zustand + React Query |
| API      | NestJS + TypeScript + Prisma ORM                   |
| Jobs     | Rust + Tokio + sqlx (for CPU-intensive tasks)      |
| Database | PostgreSQL 16 + Redis 7                            |
| Queue    | BullMQ (Redis)                                     |
| Quality  | Biome (lint/format) + Lefthook (git hooks) + strict TypeScript + Clippy |

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with Claude MAX subscription
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Node.js 20+ and Rust toolchain (`rustup`)

### Setup

Create your project folder, open Claude Code inside it, and paste this:

```
git clone https://github.com/anicdh/agstack.git _tmp && cp -r _tmp/. . && rm -rf _tmp .git && git init && git add -A && git commit -m "init: scaffold from agStack" then run /setup
```

Claude does the rest — installs dependencies, starts Docker, runs migrations, and gets your dev servers running.

`/setup` walks you through the full onboarding:

0. **Verify + install gStack** — security scan the repo, install gStack product workflow skills
1. **Project identity** — name, description, generates package.json and config files
2. **Infrastructure** — Docker Compose up, database ready, .env configured
3. **App shell** — entry points, routing, providers, dev servers verified
4. **Hand off** — clean Dummies reference, ready for product decisions

Then use `/office-hours` to start building your actual product — define your users, plan features, design your schema, and kick off your first sprint.

### Manual Setup (without the wizard)

```bash
# 1. Environment — copy and edit if needed (defaults work out of the box)
cp .env.example .env

# 2. Infrastructure — start postgres + redis
docker-compose up -d

# 3. Verify database is ready (wait a few seconds for postgres to start)
docker compose ps                   # both should show "running"

# 4. Run services
cd api && npm install && npx prisma migrate dev --name init && npm run start:dev    # terminal 1
cd frontend && npm install && npm run dev                                           # terminal 2
cd jobs && cargo build && cargo run                                                 # terminal 3
```

> **Troubleshooting:** If `prisma migrate` fails with "User was denied access", your local port 5432 may already be in use by another postgres instance. Either stop it (`brew services stop postgresql`) or change the port in `.env` and `docker-compose.yml`.

## How It Works

agStack is more than scaffolding. It teaches Claude how to be a senior developer on *your* project.

```
CLAUDE.md              → Coding conventions, reuse map, quality rules
docs/ux-guide.md       → UX principles tied to concrete UI decisions
COMPONENTS.md          → Shadcn component catalog with decision map
Dummies module         → Living reference implementation for all patterns
docs/decisions/*.md    → Architecture Decision Records (ADRs)
```

When Claude builds a new feature, it reads these files first — so it uses the right components, follows your patterns, and writes code that matches the rest of the codebase.

## Project Structure

```
├── frontend/          React SPA (Vite dev server :5173)
├── api/               NestJS REST API (:3000)
├── jobs/              Rust async job worker
├── shared/            Shared TypeScript types & Zod schemas
├── materials/         Your existing research, prototypes, reference code (local only, gitignored)
├── agile/             Backlog, sprints, velocity tracking
├── docs/              PRD, UX guide, API docs, ADRs
├── scripts/           Setup and maintenance scripts
├── .claude/           Claude Code config, skills, agents
└── infra/             Dockerfiles, deploy scripts
```

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

**Standard Mode** (recommended) — one branch per task, agents work sequentially. Agent-api finishes and merges first, then agent-frontend starts with real API to consume. Each task gets its own PR — small, easy to review, clean git history. If something breaks, you know exactly which task caused it.

**Hero Mode** — one branch per sprint, multiple agents grinding simultaneously. All agents commit on the same branch, staying in their file ownership lanes. When an agent finishes early, it picks up independent tasks. One big PR at the end of the sprint. Faster, but you need to be comfortable reviewing a larger diff.

Pick Standard when tasks depend on each other (most sprints). Pick Hero when tasks are independent and you want maximum speed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run scaffold:clean` | Remove Dummies reference code when starting your real project |
| `npm run scaffold:generate` | Regenerate Dummies reference code if needed |
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
