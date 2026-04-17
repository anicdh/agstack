---
name: python
description: >
  Use when writing or modifying any Python code (.py files) in the project.
  Hub skill that routes to specialized sub-skills for core standards, FastAPI,
  database access, async patterns, testing, and Pydantic schemas.
  MANDATORY for agent-api-python.
invocation: auto
---

# Python — Skill Hub

Quick reference for all Python sub-skills. Match your task to the right skill.

## Always Start Here

1. **Read `python-dev`** — core standards, error handling, project structure (ALWAYS)
2. **Match your task to a sub-skill below** and **read that skill file**
3. **Follow the skill's checklist before committing**

## Sub-Skills

| Task | Skill to read |
|------|---------------|
| Any .py file (error handling, typing, structure, imports) | `python-dev` |
| FastAPI router, middleware, dependency injection, request/response | `python-fastapi` |
| SQLAlchemy model, query, migration, transaction | `python-db` |
| asyncio, httpx, parallel execution, timeouts | `python-async` |
| pytest, fixtures, mocking, parametrize | `python-testing` |
| Pydantic BaseModel, validation, ConfigDict, Settings | `python-schemas` |
| WebSocket endpoint, connection manager, rooms | `python-websocket` |

## Quick Decision Tree

```
Writing/modifying Python code?
├─ Fixing error handling or imports?
│  └─ Read: python-dev
├─ Building FastAPI endpoint or middleware?
│  └─ Read: python-fastapi
├─ Querying database or writing migration?
│  └─ Read: python-db
├─ Using asyncio or httpx?
│  └─ Read: python-async
├─ Writing tests or fixtures?
│  └─ Read: python-testing
├─ Creating Pydantic model or validation?
│  └─ Read: python-schemas
└─ WebSocket endpoint, real-time, rooms?
   └─ Read: python-websocket
```

## Key Rules (Quick Reference)

| Rule | Details |
|------|---------|
| **Typing** | ALWAYS use full type hints, `from __future__ import annotations`, never `Any` unless documented |
| **Error handling** | Subclass `AppError`, never bare `except:`, no `pass` in exception handlers |
| **Async/await** | All I/O ops (DB, HTTP) MUST be async, use `asyncio.gather()` for parallel |
| **Pydantic v2** | Use `ConfigDict(from_attributes=True)`, Pydantic v2 validators, never `parse_obj()` |
| **SQLAlchemy** | Only `AsyncSession`, `select()` API, explicit transactions for multi-writes |
| **Testing** | Use `httpx.AsyncClient`, `pytest-anyio`, fixtures for DB/auth, parametrize for variants |
| **Logging** | Use `logging.getLogger(__name__)`, structured logs, never `print()` |
| **Linting** | Run `ruff check --fix`, `mypy --strict`, `pytest` before commit |

## Before Commit

```bash
# 1. Code quality
ruff check --fix .
mypy --strict app/

# 2. Tests
pytest --cov=app

# 3. Git check
git diff --stat
git status

# 4. Review each file diff
git diff app/

# 5. Commit
git commit -m "type(scope): description"
```

## Related Skills
- `postgres` — Schema design, migration patterns
- `typescript-nestjs` — Understand NestJS patterns (agent-api uses similar DI/error handling)

## Need Help?

Each sub-skill has:
- **SKILL.md** — Implementation guide with code examples and checklist
- **gotchas.md** — Common pitfalls, symptoms, and fixes

Pick the sub-skill that matches your task, read both files, then code with confidence.
