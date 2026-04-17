# Asyncio & Async Gotchas

## 1. Mixing Sync (requests) and Async Code — Blocks Event Loop

**Symptom:** Using sync `requests` library in async function hangs everything (blocks event loop).

```python
import requests
import asyncio

# ❌ WRONG — sync library in async function
async def fetch_users():
    response = requests.get("https://api.example.com/users")  # BLOCKS event loop!
    # All other async tasks stop running until this completes
    return response.json()

# No other async tasks run while requests.get() executes
```

**Cause:** `requests` is synchronous and blocks the event loop, preventing other tasks from running.

**Fix:** Use `httpx.AsyncClient` for async HTTP requests.

```python
import httpx

# ✅ CORRECT — async library
async def fetch_users():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/users")
        return response.json()

# Event loop can switch to other tasks while waiting for response
```

---

## 2. Forgetting `await` on Async Function Call — Code Doesn't Run

**Symptom:** Calling async function without `await` returns unawaited coroutine; function never executes.

```python
async def fetch_data():
    await asyncio.sleep(1)
    return {"data": "result"}

async def main():
    # ❌ WRONG — forgot await
    result = fetch_data()
    # result is <coroutine object>, NOT the actual data
    print(result)  # Prints: <coroutine object fetch_data at 0x...>

# Python warns: "coroutine was never awaited"
```

**Cause:** Async functions return coroutines, which must be `await`ed to execute.

**Fix:** Always `await` async function calls.

```python
async def main():
    # ✅ CORRECT
    result = await fetch_data()
    print(result)  # Prints: {'data': 'result'}
```

---

## 3. Sequential Instead of Parallel (Missing asyncio.gather())

**Symptom:** Multiple independent async operations run one after another instead of in parallel.

```python
async def fetch_and_process():
    # ❌ WRONG — sequential (takes ~3 seconds)
    user1 = await fetch_user(1)  # 1 second
    user2 = await fetch_user(2)  # 1 second
    user3 = await fetch_user(3)  # 1 second
    # Total: 3 seconds

# ✅ CORRECT — parallel (takes ~1 second)
async def fetch_and_process():
    user1, user2, user3 = await asyncio.gather(
        fetch_user(1),
        fetch_user(2),
        fetch_user(3),
    )
    # Total: 1 second (all run concurrently)
```

**Cause:** Sequential awaits block on each operation; `gather()` runs them concurrently.

**Fix:** Use `asyncio.gather()` for independent operations.

```python
results = await asyncio.gather(
    fetch_user(1),
    fetch_user(2),
    fetch_user(3),
)
```

---

## 4. No Timeout on Network Operations — Hangs Forever

**Symptom:** Network request to slow/unresponsive server hangs indefinitely, blocking the service.

```python
# ❌ WRONG — no timeout
async with httpx.AsyncClient() as client:
    response = await client.get("https://slowapi.example.com")
    # If server is unresponsive, waits forever!
```

**Cause:** Without timeout, request waits indefinitely for response.

**Fix:** Set timeout on all network operations.

```python
# ✅ CORRECT — 5-second timeout
async with httpx.AsyncClient(timeout=5.0) as client:
    response = await client.get("https://slowapi.example.com")
    # Raises asyncio.TimeoutError if server doesn't respond in 5 seconds

# ✅ CORRECT — wrap in timeout context
async with asyncio.timeout(10):
    results = await asyncio.gather(
        fetch_api_1(),
        fetch_api_2(),
    )
    # All operations must complete within 10 seconds
```

---

## 5. Unawaited Error in gather() — Silently Fails

**Symptom:** One task in `gather()` raises exception, but code doesn't handle it; exception is lost.

```python
async def fetch_with_errors():
    results = await asyncio.gather(
        fetch_user(1),      # Succeeds
        fetch_user(999),    # Raises NotFoundError
        fetch_user(3),      # Succeeds
    )
    # Raises NotFoundError, cancels everything, loses fetch_user(3) result

# ❌ WRONG — exception kills all tasks
```

**Cause:** By default, `gather()` raises on first exception and cancels other tasks.

**Fix:** Use `return_exceptions=True` to handle failures gracefully.

```python
# ✅ CORRECT
results = await asyncio.gather(
    fetch_user(1),
    fetch_user(999),
    fetch_user(3),
    return_exceptions=True,  # Don't raise, return exceptions as values
)

# results = [user1_dict, <NotFoundError>, user3_dict]
for i, result in enumerate(results):
    if isinstance(result, Exception):
        logger.error(f"Task {i} failed: {result}")
    else:
        logger.info(f"Task {i}: {result}")
```

---

## 6. Async Context Manager Cleanup Skipped — Resource Leaks

**Symptom:** Async context manager's `__aexit__` not called; resources (connections, files) not cleaned up.

```python
# ❌ WRONG — context manager not used
async def leak_database_connection():
    db = AsyncDatabase()
    await db.__aenter__()
    result = await db.query("SELECT * FROM users")
    # Missing: await db.__aexit__()
    # Connection never closed!

# ✅ CORRECT — use async with
async def properly_cleanup():
    async with AsyncDatabase() as db:
        result = await db.query("SELECT * FROM users")
    # Connection automatically closed by context manager
```

**Cause:** Forgetting to use `async with` skips cleanup code in `__aexit__`.

**Fix:** Always use `async with` for context managers.

```python
async with AsyncDatabase() as db:
    # __aenter__ called here
    result = await db.query("...")
    # __aexit__ automatically called, cleanup happens
```
