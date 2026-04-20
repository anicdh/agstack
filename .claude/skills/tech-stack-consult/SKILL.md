---
name: tech-stack-consult
description: >
  Use BEFORE /setup to decide the backend stack for a new project.
  Asks about workload, team skills, and deploy constraints, then recommends
  one of four profiles: nestjs-only (default, BullMQ in NestJS), nestjs-rust
  (adds Rust worker), go-only (React + user's Go backend), or python-only
  (React + user's Python backend).
  Writes the decision to `.agstack/stack.json` so /setup can scaffold correctly.
invocation: manual
---

# /tech-stack-consult — Backend Stack Decision

> Pick the right backend stack BEFORE scaffolding. The default is `nestjs-only`
> (NestJS + BullMQ). Use this skill to evaluate whether you need `nestjs-rust`
> (adds a Rust worker), `go-only`, or `python-only` instead.

## When to use

Run `/tech-stack-consult` **before** `/setup` when:
- Starting a new project from agStack
- You're not sure whether you need the Rust job worker
- You're evaluating whether agStack fits your project at all

If you skip this skill, `/setup` assumes the default profile: `nestjs-only`.

## Output

This skill writes `.agstack/stack.json` at the repo root. `/setup` reads this
file and adjusts scaffolding accordingly. Example:

```json
{
  "profile": "nestjs-only",
  "reason": "Low-traffic SaaS, no CPU-heavy jobs, solo dev in TS",
  "jobRunner": "bullmq-in-nestjs",
  "decidedAt": "2026-04-16"
}
```

It also writes an ADR to `docs/decisions/000-tech-stack.md` capturing the
reasoning, so future contributors understand why the stack looks the way it does.

---

## Instructions

You are helping the user choose a backend profile. Keep it short — 5 questions
max, then recommend. Do NOT rabbit-hole into micro-benchmarks. The goal is a
defensible default the user can change later.

### Step 1: Ask the 5 questions (one at a time, AskUserQuestion)

Use the AskUserQuestion tool, one question per turn. Record answers as you go.

**Q1. Does your product need CPU-heavy background jobs?**
- Image/video processing (resize, transcode, thumbnails)
- PDF/report generation at scale (>100/min)
- Web scraping or crawling at scale
- ML inference or heavy data transformation
- Cryptographic work (signing, hashing millions of items)

Options:
- `Yes, regularly` → jobs are a core feature
- `Occasional, low volume` (<10/min) → can run inside NestJS fine
- `No` → no background work beyond sending emails/webhooks

**Q2. Do you expect high concurrent traffic?**
- `Low` (<100 req/s) — typical SaaS MVP, internal tool, dashboard
- `Medium` (100–1000 req/s) — consumer app, growing startup
- `High` (>1000 req/s) — public API, high-traffic product

**Q3. Team's primary backend language?**
- `TypeScript` — team writes Node/TS (uses NestJS)
- `TypeScript + Rust` — team has TS and has shipped Rust (can own the jobs crate)
- `Go` — team prefers Go backends; won't write NestJS
- `Python` — team prefers Python backends (Django/FastAPI); won't write NestJS

**Q4. Deployment target?**
- `PaaS single-service` — Railway, Render, Fly.io single app
- `PaaS multi-service` — Railway/Render/Fly.io with multiple services
- `Container platform` — ECS, Cloud Run, Kubernetes
- `VPS / bare metal` — DigitalOcean droplet, Hetzner, self-hosted

**Q5. Realtime needs?**
- `None` — normal request/response
- `Some` — notifications, presence, basic WebSocket rooms
- `Heavy` — live collaboration, multiplayer, streaming

### Step 2: Decide the profile

Apply these rules in order (first match wins). Team language (Q3) dominates —
if the team doesn't write TypeScript backends, NestJS is a non-starter.

```
# --- Non-TypeScript teams: frontend-only, user writes own backend ---
IF Q3 == "Go"
    → profile = "go-only"
    → jobRunner = "user-owned"
    → reason: "Team writes Go backends. agStack provides React frontend only; user writes Go API + worker (Chi + pgx + asynq suggested)."

ELIF Q3 == "Python"
    → profile = "python-only"
    → jobRunner = "user-owned"
    → reason: "Team writes Python backends. agStack provides React frontend only; user writes Python API + worker (FastAPI/Django + Celery/RQ)."

# --- TypeScript teams: full agStack, tune the worker ---
IF Q1 == "No" AND Q2 == "Low"
    → profile = "nestjs-only"
    → jobRunner = "bullmq-in-nestjs"

ELIF Q1 == "Occasional, low volume" AND Q3 != "TypeScript + Rust"
    → profile = "nestjs-only"
    → jobRunner = "bullmq-in-nestjs"
    → reason: "Low job volume + no Rust expertise. Start simple; split out Rust later if profiling says so."

ELIF Q1 == "Occasional, low volume" AND Q3 == "TypeScript + Rust"
    → profile = "nestjs-only"
    → jobRunner = "bullmq-in-nestjs"
    → reason: "Low job volume — BullMQ handles this fine. Rust expertise is available but not needed yet; easy to upgrade later."

ELIF Q1 == "Yes, regularly" AND Q3 == "TypeScript + Rust"
    → profile = "nestjs-rust"
    → jobRunner = "rust-worker"
    → reason: "Heavy jobs + Rust expertise available. Rust worker gives best performance for CPU-intensive work."

ELIF Q1 == "Yes, regularly" AND Q3 == "TypeScript"
    → profile = "nestjs-only"
    → jobRunner = "bullmq-in-nestjs"
    → reason: "Heavy jobs needed, but team has no Rust. Ship on BullMQ, plan to revisit when perf becomes a real bottleneck (not speculatively)."
    → flag: "consider-hiring-or-learning-rust"

ELIF Q1 == "No" AND Q2 != "Low"
    → profile = "nestjs-only"
    → jobRunner = "bullmq-in-nestjs"
    → reason: "No heavy jobs. Higher traffic is handled by NestJS scaling, not a separate Rust worker."

ELSE
    → profile = "nestjs-only"
    → jobRunner = "bullmq-in-nestjs"
    → reason: "Fallback — no exact match. Start with NestJS + BullMQ (simplest full-stack). Upgrade to nestjs-rust later if profiling shows need."
```

Edge cases:
- **Q4 == "PaaS single-service"** AND profile == `nestjs-rust` → surface the tradeoff:
  > "PaaS single-service deploys don't run two binaries. You'd need to deploy
  > the Rust worker separately. If that's a blocker, switch to `nestjs-only` with
  > `bullmq-in-nestjs`. Proceed with `nestjs-rust` anyway?"
- **Q5 == "Heavy"** → note: agStack doesn't ship a realtime gateway. Point to
  Socket.IO / NestJS Gateways in the ADR as a follow-up decision, don't block.

### Step 3: Present the recommendation

Show the user:

```
Recommended profile: <profile>
Job runner:          <jobRunner>

Why this profile:
- <one line per Q answer that drove the decision>

What /setup will do:
- nestjs-only (default):
    * Keep /api (NestJS) and /frontend (React)
    * Replace /jobs (Rust) with a light BullMQ worker file inside /api
    * Remove Rust from docker-compose.yml and CI
    * Simplest deploy: 1 Node service + Postgres + Redis
- nestjs-rust:
    * Keep /api, /frontend, /jobs (Rust) as is
    * 2 runtimes (Node + Rust), 2 Dockerfiles, 2 CI pipelines
    * Best for CPU-heavy jobs when team knows Rust
- go-only:
    * Keep /frontend (React) only
    * Delete /api, /jobs, /shared (TS-only) — you'll write your own Go backend
    * Leaves a `backend-external/README.md` pointing to a suggested layout
    * Frontend api-client.ts base URL becomes a placeholder you wire up
- python-only:
    * Same as go-only but for Python (FastAPI/Django suggested in README)

Proceed with <profile>? (yes / pick another / explain more)
```

Wait for explicit user confirmation. If they pick another, just honor it and move on — don't lecture.

### Step 4: Write the decision files

After confirmation:

**File 1: `.agstack/stack.json`** (create directory if missing)

```bash
mkdir -p .agstack
```

Write:

```json
{
  "profile": "<chosen>",
  "jobRunner": "<chosen>",
  "reason": "<1-line summary>",
  "answers": {
    "jobsHeavy": "<Q1>",
    "traffic": "<Q2>",
    "teamSkills": "<Q3>",
    "deploy": "<Q4>",
    "realtime": "<Q5>"
  },
  "decidedAt": "<ISO date>",
  "decidedBy": "tech-stack-consult"
}
```

**File 2: `docs/decisions/000-tech-stack.md`** (ADR)

Use this exact template — fill in the brackets:

```markdown
# ADR 000: Tech Stack Profile

## Status
Accepted

## Context
agStack defaults to NestJS + BullMQ (`nestjs-only`). For this project we evaluated
whether that default fits or a different profile is better, based on workload,
team skills, and deploy constraints.

## Decision
**Profile: `<profile>`** — job runner: `<jobRunner>`

## Reasons
- Workload (Q1): <answer>
- Traffic (Q2): <answer>
- Team skills (Q3): <answer>
- Deploy (Q4): <answer>
- Realtime (Q5): <answer>

## Trade-offs
<one line per tradeoff the chosen profile makes>

## Revisit when
- Background jobs become a measurable bottleneck in NestJS (p95 handler > 500ms from job work)
- Traffic crosses the threshold that triggered the next profile up
- Team adds Rust/Go expertise

## Supersedes
- ADR 002 (Rust for Jobs) — if profile != `nestjs-rust`, this ADR overrides 002 for this project.
```

### Step 5: Hand off to /setup

Tell the user:

> **Decision saved.** `.agstack/stack.json` and `docs/decisions/000-tech-stack.md` are written.
>
> Next: run `/setup`. It will read `.agstack/stack.json` and scaffold the right
> stack — no prompts about Rust if you chose `nestjs-only`.
>
> You can re-run `/tech-stack-consult` later to change profile, but after `/setup`
> has scaffolded, switching profiles requires manual cleanup.

---

## Rules for this skill

1. Ask ONE question at a time via AskUserQuestion. Never dump all 5 at once.
2. Decision rules are deterministic — don't invent new profiles. If the matrix
   doesn't cover a case, keep the default `nestjs-only` and explain why.
3. Do NOT benchmark, research libraries, or read other codebases during this
   skill. The whole point is a fast default; deep research happens in
   `/plan-eng-review` later if needed.
4. NEVER scaffold code in this skill — only write `.agstack/stack.json` and the ADR.
5. If the user pushes back on the recommendation, just accept their choice and
   record it. The user knows their project better than the rules do.
6. If `.agstack/stack.json` already exists, show it and ask whether to overwrite.

## Anti-patterns — NEVER do

- ❌ Asking 10+ questions — 5 is the cap
- ❌ Recommending Rust "for the learning experience" — the rule is workload-driven
- ❌ Hiding the tradeoff of the recommended profile — always state it
- ❌ Scaffolding files (package.json, docker-compose) — that's `/setup`'s job
- ❌ Overwriting `.agstack/stack.json` without confirmation
