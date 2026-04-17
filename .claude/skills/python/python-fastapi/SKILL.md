---
name: python-fastapi
description: >
  Use when building FastAPI routers, middleware, dependency injection, request/response handling,
  or status codes. Covers APIRouter, Depends(), status codes, background tasks, and error handling.
  ALWAYS read python-dev first.
invocation: auto
---

# FastAPI Patterns & Best Practices

> **Prerequisites:** Read `python-dev` first. This skill covers routers, DI, request/response, and error handlers.

## Router Structure

### Basic Router Pattern

```python
# ✅ CORRECT — APIRouter with prefix and tags
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.deps import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse
from app.services.users import UserService
from app.errors import NotFoundError, BadRequestError

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Create a new user.
    
    Args:
        user_in: User creation payload.
        db: Database session (auto-injected).
    
    Returns:
        Created user.
    
    Raises:
        BadRequestError: If email already exists.
    """
    service = UserService(db)
    try:
        user = await service.create_user(user_in.name, user_in.email)
    except ValueError as e:
        raise BadRequestError(str(e))
    return UserResponse.from_orm(user)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Retrieve a user by ID."""
    service = UserService(db)
    user = await service.get_user(user_id)
    if not user:
        raise NotFoundError("User", user_id)
    return UserResponse.from_orm(user)

# ❌ WRONG — no APIRouter, no prefix, no tags
@app.get("/get_user")
def get_user_sync(user_id: int):
    ...
```

**Rules:**
- ALWAYS use `APIRouter` with `prefix` and `tags`
- ALWAYS set `response_model` for typed responses
- ALWAYS use correct `status_code` (201 for creation, 204 for delete, etc.)
- NEVER call service methods inside route (inject via Depends if needed)
- NEVER return raw dicts — use Pydantic schemas

### Registering Routers in main.py

```python
# ✅ CORRECT
from fastapi import FastAPI
from app.routers import users, orders, products

app = FastAPI(title="My API", version="1.0.0")

app.include_router(users.router)
app.include_router(orders.router)
app.include_router(products.router)

# ❌ WRONG — defining routes directly on app
@app.get("/users")
def get_users():
    ...
```

**Rules:**
- All routes in `app/routers/` modules
- Routers imported and registered in `main.py`
- Each resource gets its own router file

## Dependency Injection (Depends)

### Common Dependencies

```python
# app/db/deps.py — database session dependency
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.engine import AsyncSessionLocal

async def get_db() -> AsyncSession:
    """Provide database session.
    
    Yields:
        AsyncSession: Database session auto-closed after request.
    """
    async with AsyncSessionLocal() as session:
        yield session

# app/middleware/auth.py — authentication dependency
from fastapi import HTTPException, status
from app.schemas import TokenPayload

async def get_current_user(
    token: str = Header(None),
) -> TokenPayload:
    """Verify JWT token and return user payload.
    
    Args:
        token: Bearer token from Authorization header.
    
    Returns:
        Decoded token payload.
    
    Raises:
        HTTPException: If token invalid.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    # Verify token here
    return TokenPayload(user_id=123)

# ✅ CORRECT — using dependencies in routes
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user's profile."""
    service = UserService(db)
    user = await service.get_user(current_user.user_id)
    return UserResponse.from_orm(user)

# ❌ WRONG — no dependency injection
@router.get("/me")
def get_current_user_profile():
    db = create_session()  # Manual session creation
    token = request.headers.get("authorization")  # Manual parsing
    ...
```

**Rules:**
- ALL database sessions via `Depends(get_db)`
- ALL authentication checks via `Depends(get_current_user)`
- Dependencies handle resource cleanup (use `yield` for context managers)
- NO manual resource creation in route handlers

## Request/Response Models with Pydantic v2

### Request Models

```python
from pydantic import BaseModel, EmailStr, Field, field_validator

# ✅ CORRECT — clear field validation
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="User's full name")
    email: EmailStr = Field(description="User's email address")
    age: int | None = Field(None, ge=0, le=150, description="User's age")
    
    @field_validator("name")
    @classmethod
    def name_must_be_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be whitespace only")
        return v.strip()

# ❌ WRONG — no validation
class UserCreate(BaseModel):
    name: str
    email: str
    age: int
```

### Response Models

```python
from pydantic import BaseModel, ConfigDict
from datetime import datetime

# ✅ CORRECT — read from ORM, serialize with ConfigDict
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Usage in route:
@router.post("/", response_model=UserResponse)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.create_user(user_in.name, user_in.email)
    return user  # Pydantic auto-serializes SQLAlchemy model using from_attributes=True

# ❌ WRONG — manual dict conversion
return {"id": user.id, "name": user.name, ...}

# ❌ WRONG — Pydantic v1 parse_obj (deprecated in v2)
return UserResponse.parse_obj(user)
```

**Rules:**
- ALL request bodies are Pydantic models (never accept raw `dict`)
- ALL responses use `response_model` parameter with Pydantic schema
- Use `ConfigDict(from_attributes=True)` to serialize SQLAlchemy ORM objects
- Use v2 validators: `@field_validator` on class methods
- NEVER return raw dicts or lists

## HTTP Status Codes

```python
from fastapi import status

# ✅ CORRECT — explicit status codes
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    ...

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    ...

@router.get("/", status_code=status.HTTP_200_OK)
async def list_users(db: AsyncSession = Depends(get_db)):
    ...

# Common status codes:
# 200 — GET successful
# 201 — POST successful (created)
# 204 — DELETE/PUT successful (no content)
# 400 — Bad request (validation error)
# 401 — Unauthorized (missing/invalid auth)
# 403 — Forbidden (authenticated but no permission)
# 404 — Not found
# 500 — Server error

# ❌ WRONG — default status code
@router.post("/")
async def create_user(...):
    ...  # Defaults to 200, should be 201
```

## Middleware

### Custom Middleware

```python
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import time

logger = logging.getLogger(__name__)

# ✅ CORRECT — logging middleware
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)"
        )
        return response

# Register in main.py
app.add_middleware(LoggingMiddleware)

# ❌ WRONG — blocking middleware
class SlowMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        time.sleep(1)  # Blocks entire request!
        ...
```

**Rules:**
- Middleware MUST be `async` to avoid blocking
- Register middleware in `main.py` with `app.add_middleware()`
- Use CORS middleware only if needed: `CORSMiddleware`
- NEVER do I/O in middleware synchronously

## Global Error Handler

```python
# app/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.errors import AppError

app = FastAPI()

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    """Handle custom application errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "statusCode": exc.status_code,
            "message": exc.message,
            "detail": exc.detail,
        },
    )

@app.exception_handler(Exception)
async def general_error_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "statusCode": 500,
            "message": "Internal server error",
            "detail": None,
        },
    )
```

## Implementation Checklist

Before submitting router code:

- [ ] Router uses `APIRouter` with `prefix` and `tags`
- [ ] All routes have `response_model` parameter
- [ ] Correct HTTP status codes used (201 for POST, 204 for DELETE)
- [ ] Database session injected via `Depends(get_db)`
- [ ] All authentication checks via `Depends(get_current_user)`
- [ ] Request bodies are Pydantic models (not raw `dict`)
- [ ] Responses are Pydantic models (not raw dicts)
- [ ] Business logic in services, not routes
- [ ] All exceptions are custom `AppError` subclasses
- [ ] Global error handler in `main.py`

## Before Commit

```bash
# Type check FastAPI routes
mypy --strict app/routers/

# Test routes
pytest tests/test_routers.py -v

# Check compliance
ruff check app/routers/ --fix
```
