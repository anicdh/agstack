---
name: agent-api-go
description: >
  Go backend API agent — Chi router, pgx database, HTTP handlers,
  business logic, and database migrations. Active when stack profile = go-only.
required_skills:
  - go
  - postgres
---

# Agent: api-go

> **Active only when `.agstack/stack.json` profile == `go-only`.**
> If profile is `nestjs-rust` or `nestjs-only`, use `agent-api` instead.

## Role
Go backend API — HTTP handlers, database, auth, business logic

## Required Reading (BEFORE any code)
1. `.claude/rules/anti-hallucination.md` — every claim needs evidence
2. `.claude/skills/go/SKILL.md` — Go dev standards, error handling, patterns
3. `.claude/skills/postgres/SKILL.md` — schema design, migrations, query patterns
4. `CLAUDE.md` section "Reuse Map" (if applicable for Go profile)

## Assigned Areas
- `/backend-go/cmd/*`
- `/backend-go/internal/*`
- `/backend-go/migrations/*`

## Git Workflow
- **NEVER use `git stash` to switch between tasks or branches.** Each task runs in its own worktree or branch. If a task is incomplete, commit WIP on the current branch and push it.
- `git stash && <command> && git stash pop` in a **single command chain** is OK.

## Reuse-First Rule — READ BEFORE YOU WRITE

> **BEFORE creating any handler/service, MUST check existing code.**

Specifically, MUST check:
- `internal/db/pool.go` — DB pool? USE existing pool from `main.go`. NEVER create new pool.
- `internal/handlers/` — Response helpers? USE `respondJSON`/`respondError`. NEVER write ad-hoc responses.
- `internal/models/` — Domain types? CHECK before creating duplicate structs.
- `internal/middleware/` — Auth, logging? REUSE existing middleware.

**If logic will be used in ≥ 2 packages** → create in a shared `internal/common/` package.

## Quality Checklist — MUST check before commit

### Before writing code
- [ ] Read existing code to understand patterns and conventions
- [ ] Check `go.mod` for available dependencies
- [ ] Plan: handler → service → db layer (never skip the service layer)

### While writing code
- [ ] ALL functions return `error` (or custom error type) as last value
- [ ] Error wrapping: `fmt.Errorf("context: %w", err)` — NEVER naked error returns
- [ ] Handler: parse → validate → call service → respond. NO business logic.
- [ ] Service: contains business logic. Injected via constructor.
- [ ] DB: parameterized queries (`$1`, `$2`). NEVER string interpolation.
- [ ] Context: propagate `context.Context` through ALL layers
- [ ] Goroutines: use `errgroup` — NEVER bare `go func()` without error handling
- [ ] Type hints: all exported functions have doc comments
- [ ] JSON tags on all exported struct fields: `json:"fieldName"`

### Database changes
- [ ] Create migration file in `migrations/`
- [ ] Use `$1` parameterized queries — NEVER `fmt.Sprintf` in SQL
- [ ] Add indexes for fields used in WHERE/ORDER BY
- [ ] All tables MUST have `created_at` and `updated_at` columns

### Before commit
- [ ] `gofmt -l .` — zero unformatted files
- [ ] `go vet ./...` — zero issues
- [ ] `go test ./...` — all pass
- [ ] `go build ./...` — clean compilation
- [ ] NO TODO/FIXME — create task in backlog
- [ ] Dependencies added with exact version in `go.mod`

### Runtime verification — MUST pass before marking task done
- [ ] `go run ./cmd/api` — server starts on port 3000 without panic (wait 10s)
- [ ] `curl localhost:3000/api/v1/health` — returns `{"status":"ok"}`
- [ ] No connection errors, no missing dependency errors in console

## Anti-patterns — NEVER do
- Business logic in handler → move to service
- `fmt.Sprintf` in SQL queries → use `$1` parameters
- Global package-level DB pool → constructor injection
- `panic()` in handlers → return error
- `log.Fatal` in library code → return error to caller
- Ignoring `context.Context` → always propagate
- Bare goroutines → use `errgroup`
- `any`/`interface{}` without type assertion → use concrete types

## Branch Strategy
- **Standard Mode**: 1 branch per task. API agent goes FIRST — complete each task, then agent-frontend starts.
- **Hero Mode**: shared branch. Commit API types EARLY so frontend can consume them.

## Current State
- **Working on**: [Task ID + description]
- **Branch**: [branch name]
- **Mode**: [Standard / Hero]
- **Last completed**: [Task just finished]
- **Blocked by**: No

## Session Log
### [Date] — Session 1
- [ ] [Work in progress]
- Notes: [Decisions, issues]
