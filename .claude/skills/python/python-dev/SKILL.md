---
name: python-dev
description: >
  ALWAYS read this BEFORE writing or modifying any Python code (.py files).
  Covers project structure, imports, error handling, logging, type hints, and core dev standards.
  Required before touching any other sub-skill.
invocation: auto
---

# Python Core Development Standards

> **MANDATORY:** Read this BEFORE any `.py` file work. It establishes the foundation for all other Python skills.

## Before Writing Any Code

1. Read existing code in the package to understand patterns
2. Check `pyproject.toml` for available dependencies — DO NOT add deps without checking first
3. Verify project structure matches the pattern below
4. Run linters and formatters locally before committing

## Project Structure (Standard Layout)

```
backend-python/
├── app/
│   ├── main.py                — FastAPI app, middleware, routers
│   ├── config.py              — Pydantic Settings (environment variables)
│   ├── routers/               — API route modules (one file per resource)
│   ├── services/              — Business logic layer
│   ├── models/                — SQLAlchemy ORM models
│   │   └── base.py            — Base model with common columns
│   ├── schemas/               — Pydantic request/response models
│   ├── db/
│   │   ├── engine.py          — Async engine + session factory
│   │   └── deps.py            — FastAPI Depends() functions
│   ├── middleware/            — Custom middleware
│   ├── errors.py              — Exception classes
│   └── utils.py               — Helper functions
├── tests/
│   ├── conftest.py            — Pytest fixtures
│   ├── test_routers.py
│   └── test_services.py
├── migrations/                — Alembic migration files
├── pyproject.toml             — Dependencies + tool config
├── .env.example               — Template (NEVER commit .env)
└── Dockerfile
```

**Key architecture rules:**
- ALL application code in `app/` — single package with clean boundaries
- **Request flow:** Router → Service → DB Model (never skip layers)
- One router file per resource: `routers/users.py`, `routers/orders.py`, etc.
- Services contain business logic, not routers
- Models are pure database mapping (no business logic)
- Schemas for ALL request/response bodies — NEVER return raw `dict` or `list`

## Imports & Dependencies

### Proper Import Style

```python
# ✅ CORRECT — explicit imports, stdlib first, then third-party, then local
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas import UserResponse

logger = logging.getLogger(__name__)

# ❌ WRONG — star imports, unordered, no __future__
from app import *
import requests
import logging as lg
```

**Rules:**
- ALWAYS `from __future__ import annotations` at top (allows forward references)
- Import order: stdlib → third-party → local (use isort if available)
- NO star imports (`from x import *`)
- NO inline imports except in tight loops (move to top)
- NO relative imports in modules under `app/` (use absolute: `from app.models import User`)

## Error Handling

### Exception Hierarchy

```python
# ✅ CORRECT — custom exception hierarchy rooted in AppError
class AppError(Exception):
    """Base exception for all application errors."""
    def __init__(self, status_code: int, message: str, detail: str | None = None):
        self.status_code = status_code
        self.message = message
        self.detail = detail

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str | int):
        super().__init__(404, f"{resource} {resource_id} not found")

class BadRequestError(AppError):
    def __init__(self, message: str):
        super().__init__(400, message)

class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(401, message)

class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(403, message)

# In app/main.py — register global handler
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "statusCode": exc.status_code,
            "message": exc.message,
            "detail": exc.detail,
        },
    )

# ✅ CORRECT — specific exception raising
async def get_user(user_id: int, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise NotFoundError("User", user_id)
    return user

# ❌ WRONG — bare exceptions, string messages, no context
raise Exception("something went wrong")
raise ValueError("bad input")
try:
    ...
except:
    pass
```

**Rules:**
- NEVER bare `except:` or bare `except Exception:`
- ALWAYS catch specific exceptions
- NEVER `pass` in exception handlers (log, re-raise, or handle)
- NEVER return `None` for errors — raise exceptions
- Custom exceptions MUST inherit from `AppError`

## Type Hints & Typing

### Full Type Hints (Strict Mode)

```python
from __future__ import annotations

from typing import Any, Optional, Callable
from sqlalchemy.ext.asyncio import AsyncSession

# ✅ CORRECT — all parameters and return types annotated
async def create_user(
    db: AsyncSession,
    name: str,
    email: str,
) -> User:
    """Create a new user in the database.
    
    Args:
        db: Database session.
        name: User's full name.
        email: User's email address.
    
    Returns:
        Created User instance.
    
    Raises:
        BadRequestError: If email already exists.
    """
    user = User(name=name, email=email)
    db.add(user)
    await db.commit()
    return user

# ❌ WRONG — missing type hints
def create_user(db, name, email):
    ...

# ❌ WRONG — using Any without explanation
def process_data(data: Any) -> Any:
    ...

# ✅ CORRECT — Any with explanation/comment
def parse_config(raw_json: Any) -> dict[str, Any]:
    """Parse JSON config (may have arbitrary structure from external source)."""
    ...

# ✅ CORRECT — Optional for nullable values
def find_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    ...

# ❌ WRONG — None should be in union, not Optional alone
def find_user_by_email(db: AsyncSession, email: str) -> User | None:
    # Better: explicitly use | None instead of Optional
    ...
```

**Rules:**
- ALWAYS use `from __future__ import annotations` (allows forward refs)
- ALL function parameters and return types MUST be annotated
- NEVER use `Any` without a comment explaining why
- Use `X | None` (PEP 604) instead of `Optional[X]`
- Use type aliases for complex types: `UserId = int`
- Docstrings: Google style with Args, Returns, Raises sections

## Logging (Never `print()`)

```python
import logging

# ✅ CORRECT — structured logging with logger instance
logger = logging.getLogger(__name__)

async def process_order(order_id: int):
    logger.info(f"Processing order {order_id}")
    try:
        result = await fetch_payment(order_id)
        logger.info(f"Payment processed for order {order_id}: ${result.amount}")
    except PaymentError as e:
        logger.error(f"Payment failed for order {order_id}", exc_info=True)
        raise

# ❌ WRONG — print(), no context
print("Processing order")
print(f"Amount: {amount}")

# ❌ WRONG — logging sensitive data
logger.info(f"User token: {token}")  # NEVER log tokens, passwords, PII
logger.info(f"Database URL: {db_url}")
```

**Rules:**
- Create logger: `logger = logging.getLogger(__name__)` at module top
- NEVER use `print()` — use logger instead
- Log at appropriate levels: DEBUG < INFO < WARNING < ERROR < CRITICAL
- NEVER log passwords, tokens, API keys, PII, or connection strings
- Use `exc_info=True` when logging exceptions in except blocks

## Docstrings (Google Style)

```python
# ✅ CORRECT — Google style docstring
def calculate_discount(price: float, discount_percent: float) -> float:
    """Calculate final price after applying discount.
    
    Args:
        price: Original price in dollars.
        discount_percent: Discount percentage (0-100).
    
    Returns:
        Final price after discount.
    
    Raises:
        ValueError: If discount_percent is not between 0-100.
    """
    if not 0 <= discount_percent <= 100:
        raise ValueError(f"Discount must be 0-100, got {discount_percent}")
    return price * (1 - discount_percent / 100)

# ✅ CORRECT — minimal docstring for simple functions
def is_valid_email(email: str) -> bool:
    """Check if email format is valid."""
    ...

# ❌ WRONG — no docstring
def calculate_discount(price, discount):
    return price * (1 - discount / 100)
```

**Rules:**
- ALWAYS docstring public functions (those called outside module)
- Google style: one-line summary, then Args/Returns/Raises
- First line MUST be a complete sentence ending with period
- Private functions (_function) may have minimal docstrings

## Configuration & Environment Variables

```python
# ✅ CORRECT — centralized Pydantic Settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    debug: bool = False
    api_key: str
    
    class Config:
        env_file = ".env"

# app/config.py
settings = Settings()

# In routers/services, use injected settings:
async def some_route(settings: Settings = Depends(get_settings)):
    db_url = settings.database_url

# ❌ WRONG — scattered os.environ.get()
import os
db_url = os.environ.get("DATABASE_URL")
redis_url = os.environ.get("REDIS_URL")
api_key = os.environ.get("API_KEY")

# ❌ WRONG — hardcoded values
DATABASE_URL = "postgres://localhost/mydb"
```

**Rules:**
- Centralize all config in `app/config.py` using Pydantic Settings
- NEVER hardcode values — all config from environment or `.env`
- NEVER commit `.env` file (use `.env.example` template instead)
- Validate config at startup (Settings instantiation will fail early if invalid)

## Implementation Checklist

Before submitting code:

- [ ] **Imports**: No star imports, proper order (stdlib → third-party → local)
- [ ] **Type hints**: All functions have parameter and return type annotations
- [ ] **Error handling**: Custom exceptions, no bare `except:`, all errors are `AppError` subclasses
- [ ] **Logging**: Uses `logging.getLogger(__name__)`, no `print()`
- [ ] **Docstrings**: Public functions have Google-style docstrings
- [ ] **Config**: All environment variables in `Settings` class, not scattered
- [ ] **Async/await**: All I/O operations (DB, HTTP) are `async`, functions `await` properly
- [ ] **Pydantic**: All request/response bodies are Pydantic models, not raw dicts
- [ ] **Testing**: All public functions have unit tests in `tests/`
- [ ] **Linting**: `ruff check --fix` and `mypy --strict` pass without errors

## Before Commit

```bash
# 1. Format code
ruff check --fix .
ruff format .

# 2. Type checking
mypy --strict app/

# 3. Run tests
pytest tests/ -v --cov=app

# 4. Manual review
git diff app/
git status

# 5. Commit with conventional message
git commit -m "feat(users): add user creation endpoint"
```

## Anti-Patterns — NEVER Do These

| Anti-pattern | Why it's wrong | Fix |
|-------------|-------|-----|
| `print()` for output | No logging context | Use `logger.info()` |
| Star imports | Pollutes namespace | Import specific names |
| Bare `except:` | Catches SystemExit, KeyboardInterrupt | Catch specific exceptions |
| Business logic in routes | Violates MVC pattern | Move to services |
| Raw dicts as responses | No validation | Use Pydantic models |
| `os.environ` scattered | Configuration spread across codebase | Centralize in Settings |
| Mutable defaults | Shared state bug | Use `None` + factory pattern |
| Missing type hints | Hard to understand | Add types to all functions |
| No docstrings | Unclear intent | Document public functions |
| Sync I/O in async code | Blocks event loop | Use `async def` and `await` |
