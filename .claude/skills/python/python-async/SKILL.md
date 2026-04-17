---
name: python-async
description: >
  Use when implementing asyncio patterns, concurrent operations with asyncio.gather(),
  HTTP requests with httpx, timeouts, and async/await patterns.
  Covers coroutines, event loop management, and async context managers.
  ALWAYS read python-dev first.
invocation: auto
---

# Asyncio & Async Patterns

> **Prerequisites:** Read `python-dev` first. This skill covers async/await, concurrency, and async I/O.

## Async Functions & Await

### Basic Async Function

```python
import asyncio

# ✅ CORRECT — async function returns coroutine
async def fetch_user(user_id: int) -> dict:
    """Fetch user from API (async operation)."""
    # Simulating async I/O delay
    await asyncio.sleep(1)
    return {"id": user_id, "name": "John"}

# ✅ CORRECT — must await to execute
async def main():
    user = await fetch_user(1)  # Must use await
    print(user)

# Run async main function
asyncio.run(main())

# ❌ WRONG — calling without await (returns coroutine, doesn't execute)
user = fetch_user(1)  # Returns <coroutine>, never executes
print(user)  # Prints: <coroutine object>

# ❌ WRONG — calling sync function as async
def fetch_user_sync(user_id: int) -> dict:
    return {"id": user_id}

await fetch_user_sync(1)  # TypeError — can't await non-async function
```

**Rules:**
- Functions that do I/O (network, DB) MUST be `async def`
- ALWAYS `await` async function calls
- NEVER call async function without `await` (returns unawaited coroutine)
- Sync functions cannot be called with `await`

## Concurrent Operations with asyncio.gather()

### Parallel Execution

```python
import asyncio

async def fetch_user(user_id: int) -> dict:
    await asyncio.sleep(1)  # Simulates 1-second API call
    return {"id": user_id}

async def fetch_multiple_users(user_ids: list[int]) -> list[dict]:
    """Fetch multiple users in parallel (not sequential)."""
    # ✅ CORRECT — gather() runs all coroutines concurrently
    results = await asyncio.gather(
        *[fetch_user(uid) for uid in user_ids]
    )
    return results

# Example:
# Sequential: fetch_user(1) + fetch_user(2) + fetch_user(3) = 3 seconds
# Parallel: asyncio.gather() = ~1 second (all run together)

# ✅ CORRECT — named results with gather()
async def fetch_and_process():
    user1, user2, posts = await asyncio.gather(
        fetch_user(1),
        fetch_user(2),
        fetch_posts(1),
    )
    return user1, user2, posts

# ✅ CORRECT — gather() with return_exceptions
async def fetch_safely():
    """Fetch multiple users, continue even if some fail."""
    results = await asyncio.gather(
        fetch_user(1),
        fetch_user(2),
        fetch_user(999),  # Might fail
        return_exceptions=True,  # Return errors as values, don't raise
    )
    # results = [user1_dict, user2_dict, <exception object>]
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Request failed: {result}")
        else:
            logger.info(f"User: {result}")

# ❌ WRONG — sequential instead of parallel
async def fetch_sequentially():
    user1 = await fetch_user(1)  # Wait 1 second
    user2 = await fetch_user(2)  # Wait 1 second
    user3 = await fetch_user(3)  # Wait 1 second
    # Total: 3 seconds (inefficient!)
```

**Rules:**
- Use `asyncio.gather()` for parallel independent operations
- Gather is faster than sequential awaits for I/O-bound tasks
- Use `return_exceptions=True` to handle failures gracefully
- Don't gather CPU-bound operations (won't parallelize; use multiprocessing)

## HTTP Requests with httpx (Async)

### Async HTTP Client

```python
import httpx

# ✅ CORRECT — async context manager
async def fetch_from_api(url: str) -> dict:
    """Fetch JSON from API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()

# ✅ CORRECT — reuse client for multiple requests
async def fetch_multiple_endpoints(urls: list[str]) -> list[dict]:
    """Fetch from multiple endpoints efficiently."""
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[client.get(url) for url in urls]
        )
        return [r.json() for r in results]

# ✅ CORRECT — post with timeout
async def create_user(email: str) -> dict:
    """Create user via API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://api.example.com/users",
            json={"email": email},
        )
        response.raise_for_status()
        return response.json()

# ❌ WRONG — using sync requests in async context
import requests
response = requests.get("https://api.example.com/users")  # Blocks event loop!

# ❌ WRONG — forgetting to await
async with httpx.AsyncClient() as client:
    response = client.get(url)  # Returns coroutine, not result!
```

**Rules:**
- ALWAYS use `httpx.AsyncClient` for HTTP in async code
- NEVER use `requests` in async code (it's synchronous)
- Use async context manager: `async with httpx.AsyncClient() as client:`
- ALWAYS `await` HTTP calls
- Set `timeout` to prevent hanging

## Timeouts

### asyncio.timeout() (Python 3.11+)

```python
import asyncio

# ✅ CORRECT — timeout context manager
async def fetch_with_timeout(url: str) -> dict:
    """Fetch with 5-second timeout."""
    try:
        async with asyncio.timeout(5):  # Timeout after 5 seconds
            return await fetch_from_api(url)
    except asyncio.TimeoutError:
        logger.error(f"Request to {url} timed out")
        raise

# ✅ CORRECT — timeout for multiple operations
async def fetch_all_with_timeout():
    try:
        async with asyncio.timeout(10):  # All must complete in 10 seconds
            results = await asyncio.gather(
                fetch_from_api("https://api1.com"),
                fetch_from_api("https://api2.com"),
                fetch_from_api("https://api3.com"),
            )
        return results
    except asyncio.TimeoutError:
        logger.error("One or more requests timed out")
        return None

# ✅ CORRECT — httpx timeout
async with httpx.AsyncClient(timeout=5.0) as client:
    response = await client.get(url)
```

**Rules:**
- Set timeouts on I/O operations to prevent hanging indefinitely
- Use `asyncio.timeout()` for overall operation timeout
- Use httpx `timeout` parameter for individual requests
- Catch `asyncio.TimeoutError` to handle gracefully

## Async Context Managers

### Using Async Context Managers

```python
# ✅ CORRECT — async context manager pattern
class AsyncDatabase:
    async def __aenter__(self):
        """Called when entering 'async with' block."""
        self.connection = await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Called when exiting 'async with' block."""
        await self.connection.close()

# Usage:
async def query_database():
    async with AsyncDatabase() as db:
        result = await db.execute("SELECT * FROM users")
    # Connection automatically closed

# ✅ CORRECT — using FastAPI AsyncSession
from sqlalchemy.ext.asyncio import AsyncSession

async def update_user(db: AsyncSession, user_id: int, name: str):
    # db is already context-managed by FastAPI dependency
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if user:
        user.name = name
        await db.commit()
```

## Event Loop & asyncio.run()

```python
import asyncio

async def main():
    """Main async function."""
    result = await some_async_operation()
    return result

# ✅ CORRECT — run from sync context
if __name__ == "__main__":
    result = asyncio.run(main())  # Creates event loop, runs main, closes loop

# ❌ WRONG — creating event loop manually
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
result = loop.run_until_complete(main())
loop.close()
# Verbose, error-prone; use asyncio.run() instead
```

**Rules:**
- Use `asyncio.run()` to start async program from sync context
- FastAPI handles event loop creation automatically
- Don't create event loops manually; let framework manage it

## Common Async Patterns

### Sequential Then Parallel

```python
async def orchestrate_workflow():
    """Sequential step, then parallel operations."""
    # Step 1: Sequential (each step depends on previous)
    user_id = await create_user("john@example.com")
    
    # Step 2: Parallel (independent operations)
    user, posts, comments = await asyncio.gather(
        fetch_user(user_id),
        fetch_user_posts(user_id),
        fetch_user_comments(user_id),
    )
    
    return {"user": user, "posts": posts, "comments": comments}
```

### Background Tasks

```python
# ✅ CORRECT — schedule background task without waiting
async def send_email_background(email: str):
    """Send email (fire and forget)."""
    asyncio.create_task(send_email_async(email))
    # Returns immediately, email sends in background

# In FastAPI:
from fastapi import BackgroundTasks

@app.post("/users")
async def create_user(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
):
    user = await create_user_db(user_in)
    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

## Implementation Checklist

Before submitting async code:

- [ ] All I/O functions are `async def` (not sync)
- [ ] All `async` function calls use `await`
- [ ] Concurrent I/O uses `asyncio.gather()` not sequential awaits
- [ ] HTTP requests use `httpx.AsyncClient` not `requests`
- [ ] Timeouts set on all network operations
- [ ] No blocking sync operations in async functions
- [ ] Proper error handling with `try/except` around `await`
- [ ] Context managers used for resource cleanup

## Before Commit

```bash
# Type check async code
mypy --strict app/services/ app/routers/

# Run async tests
pytest tests/ -v

# Check for common async mistakes
grep -r "await fetch\|requests\." app/ --include="*.py"
```
