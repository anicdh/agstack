# Python Gotchas

## Returning Raw Dicts from Endpoints

**Symptom:** No schema validation on responses — clients get inconsistent field names, missing fields, or leaked internal data.
**Cause:** Using `-> dict` return type instead of Pydantic `response_model`.
**Fix:** Always define a Pydantic `BaseModel` and set `response_model` on the route.

```python
# ❌ WRONG
@router.get("/users/{id}")
async def get_user(id: str) -> dict:
    return {"id": id, "name": user.name}

# ✅ CORRECT
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str

@router.get("/users/{id}", response_model=UserResponse)
async def get_user(id: str, db: AsyncSession = Depends(get_db)) -> UserResponse:
    user = await service.get(db, id)
    return UserResponse.model_validate(user)
```

## Sync DB Calls in Async Context

**Symptom:** API becomes extremely slow under load — event loop blocked.
**Cause:** Using `db.query()` (sync SQLAlchemy 1.x pattern) instead of `await db.execute(select(...))`.
**Fix:** Use SQLAlchemy 2.0 async API with `select()` statements.

```python
# ❌ WRONG — blocks the event loop
def list_users(db: Session) -> list[User]:
    return db.query(User).all()

# ✅ CORRECT — non-blocking
async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User))
    return list(result.scalars().all())
```

## Session Leak

**Symptom:** Database connections exhausted — "too many connections" error under load.
**Cause:** Creating `AsyncSession` manually without cleanup (`async with` or try/finally).
**Fix:** Use the `get_db` dependency that yields a session and handles cleanup.

```python
# ❌ WRONG — session never closed
async def get_db():
    session = AsyncSession(engine)
    return session

# ✅ CORRECT — auto-cleanup
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Scattered os.environ.get()

**Symptom:** Config spread across many files — hard to see all required env vars, easy to miss one.
**Cause:** Using `os.environ.get("KEY")` directly in service/db files.
**Fix:** Centralize in `app/config.py` with Pydantic Settings.

```python
# ❌ WRONG — scattered
DATABASE_URL = os.environ.get("DATABASE_URL", "")  # in engine.py
REDIS_URL = os.environ.get("REDIS_URL", "")         # in cache.py

# ✅ CORRECT — centralized
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"

settings = Settings()  # reads from env, fails fast if missing
```

## Bare Exception Handling

**Symptom:** Errors silently swallowed — bugs hidden, debugging impossible.
**Cause:** Using `except Exception` without re-raising or logging.
**Fix:** Catch specific exceptions. If you must catch broad exceptions, log and re-raise.

```python
# ❌ WRONG — silently swallowed
try:
    await service.create(data)
except Exception:
    pass

# ✅ CORRECT — specific + logged
try:
    await service.create(data)
except NotFoundError:
    raise  # let the global handler deal with it
except Exception:
    logger.exception("Unexpected error creating resource")
    raise
```
