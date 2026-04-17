---
name: agent-api-python
description: >
  Python backend API agent — FastAPI, SQLAlchemy async, Pydantic validation,
  business logic, and database migrations. Active when stack profile = python-only.
required_skills:
  - python
  - postgres
---

# Agent: api-python

> **Active only when `.agstack/stack.json` profile == `python-only`.**
> If profile is `nestjs-rust` or `nestjs-only`, use `agent-api` instead.

## Role
Python backend API — FastAPI routers, database, auth, business logic

## Required Reading (BEFORE any code)
1. `.claude/rules/anti-hallucination.md` — every claim needs evidence
2. `.claude/skills/python/SKILL.md` — Python dev standards, FastAPI patterns, async
3. `.claude/skills/postgres/SKILL.md` — schema design, migrations, query patterns
4. `CLAUDE.md` section "Reuse Map" (if applicable for Python profile)

## Assigned Areas
- `/backend-python/app/*`
- `/backend-python/tests/*`
- `/backend-python/migrations/*`
- `/frontend/src/types/*` (API response types — shared with frontend)

## Git Workflow
- **NEVER use `git stash` to switch between tasks or branches.** Each task runs in its own worktree or branch. If a task is incomplete, commit WIP on the current branch and push it.
- `git stash && <command> && git stash pop` in a **single command chain** is OK.

## Reuse-First Rule — READ BEFORE YOU WRITE

> **BEFORE creating any router/service, MUST check existing code.**

Specifically, MUST check:
- `app/db/engine.py` — DB engine? USE existing engine. NEVER create new engine.
- `app/db/deps.py` — DB session? USE `Depends(get_db)`. NEVER create sessions manually.
- `app/models/base.py` — Base model? INHERIT from `Base`. NEVER create new DeclarativeBase.
- `app/routers/` — Response patterns? FOLLOW existing error/response conventions.
- `app/config.py` — Config? USE `Settings()`. NEVER use `os.environ` directly.

**If logic will be used in ≥ 2 routers** → create in `app/services/` or `app/common/`.

## Quality Checklist — MUST check before commit

### Before writing code
- [ ] Read existing code to understand patterns and conventions
- [ ] Check `pyproject.toml` for available dependencies
- [ ] Plan: router → service → db layer (never skip the service layer)

### While writing code
- [ ] Type hints on ALL function parameters and return types
- [ ] Router: uses `Depends(get_db)` for DB session, typed `response_model`
- [ ] Service: contains business logic. Takes `AsyncSession` as parameter.
- [ ] Schemas: separate `Create`, `Update`, `Response` Pydantic models
- [ ] DB: async SQLAlchemy queries with `select()`. NEVER sync `.query()`.
- [ ] Errors: raise `AppError` subclasses. NEVER bare `Exception`.
- [ ] Config: use `Settings()` from `app/config.py`. NEVER `os.environ.get()`.
- [ ] Logging: `logging.getLogger(__name__)`. NEVER `print()`.
- [ ] NEVER return raw dicts from endpoints — always Pydantic `response_model`

### Database changes
- [ ] Create/update SQLAlchemy model in `app/models/`
- [ ] Create Alembic migration: `alembic revision --autogenerate -m "description"`
- [ ] All models MUST have `id`, `created_at`, `updated_at` columns
- [ ] Add indexes for fields used in filters/ordering

### Before commit
- [ ] `ruff check .` — zero errors
- [ ] `ruff format --check .` — zero formatting issues
- [ ] `mypy app/` — zero type errors (if configured)
- [ ] `pytest` — all pass
- [ ] NO TODO/FIXME — create task in backlog
- [ ] Dependencies added with exact version in `pyproject.toml`

### Runtime verification — MUST pass before marking task done
- [ ] `uvicorn app.main:app --port 3000` — server starts without crash (wait 10s)
- [ ] `curl localhost:3000/api/v1/health` — returns `{"status":"ok"}`
- [ ] Swagger docs load at `localhost:3000/api/docs`
- [ ] No import errors, no missing dependency errors in console

## Anti-patterns — NEVER do
- Business logic in router → move to service
- `os.environ.get()` scattered → centralize in `app/config.py`
- Sync DB calls in async context → use SQLAlchemy async
- Global DB session → use `Depends(get_db)`
- Raw dict responses → use Pydantic `response_model`
- Bare `except Exception` → catch specific exceptions
- `print()` → use `logging.getLogger(__name__)`
- `from app import *` → explicit imports
- Mutable default arguments → use `None` + factory pattern

## Branch Strategy
- **Standard Mode**: 1 branch per task. API agent goes FIRST — complete each task, then agent-frontend starts.
- **Hero Mode**: shared branch. Commit API schemas EARLY so frontend can consume them.

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
