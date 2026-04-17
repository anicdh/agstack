# Python Development Gotchas

## 1. Mutable Default Arguments

**Symptom:** Function's default list/dict shares state across calls, causing unexpected mutations.

```python
# ❌ WRONG — users list is shared across all calls
def create_group(name: str, users: list[str] = []):
    users.append("admin")
    return {"name": name, "users": users}

# Call 1: ["admin"]
# Call 2: ["admin", "admin"]  ← Wrong! Should be ["admin"]
```

**Cause:** Python creates the default value ONCE at function definition time, not per call.

**Fix:** Use `None` and factory pattern inside function.

```python
# ✅ CORRECT
def create_group(name: str, users: list[str] | None = None):
    if users is None:
        users = []
    users.append("admin")
    return {"name": name, "users": users}
```

---

## 2. Bare `except:` Catches Everything (Even Ctrl+C)

**Symptom:** `except:` catches `KeyboardInterrupt` and `SystemExit`, breaking shutdown and debuggability.

```python
# ❌ WRONG
try:
    await fetch_data()
except:
    print("Error")

# User presses Ctrl+C → caught by bare except → ignored instead of exiting
```

**Cause:** Bare `except:` is equivalent to `except BaseException:`, which includes non-Error exceptions.

**Fix:** Always catch specific exceptions.

```python
# ✅ CORRECT
try:
    await fetch_data()
except (HTTPError, TimeoutError) as e:
    logger.error(f"Fetch failed: {e}")
    raise
```

---

## 3. Mixing `Any` Without Explanation (mypy Strict Fails)

**Symptom:** `mypy --strict` rejects code with `Any` type without comment explaining why.

```python
# ❌ WRONG — mypy rejects this
def process(data: Any) -> dict:
    return data

# mypy error: Disallowed any type (no explicit `Any` annotation)
```

**Cause:** `mypy --strict` requires explicit justification for `Any` to catch type errors.

**Fix:** Add comment explaining why `Any` is necessary.

```python
# ✅ CORRECT
def process(data: Any) -> dict:
    """Process arbitrary JSON from external API (unknown schema)."""
    # data is Any because API response has dynamic/unknown structure
    return data
```

---

## 4. Logging Sensitive Data (Security & Compliance Risk)

**Symptom:** Logs contain passwords, tokens, API keys, revealing secrets to anyone with log access.

```python
# ❌ WRONG — logs the database URL and user token
logger.info(f"Connecting to {db_url}")
logger.info(f"User token: {user_token}")

# Logs file now contains: "postgres://user:password@host:5432/db"
```

**Cause:** Developers forget that logs are stored and accessed by multiple people/systems.

**Fix:** Never log credentials; log only safe identifiers (IDs, usernames without passwords).

```python
# ✅ CORRECT
logger.info(f"Connecting to database")
logger.info(f"User {user_id} authenticated")

# If must log connection string, redact passwords:
def redact_url(url: str) -> str:
    return url.replace(url.split("://")[1].split("@")[0], "***")
```

---

## 5. `Optional[X]` vs `X | None` (Type Hint Ambiguity)

**Symptom:** Confusion between `Optional[List[str]]` (nullable list) and `List[str | None]` (list with nullable elements).

```python
# ❌ AMBIGUOUS
def process(items: Optional[List[str]]) -> None:
    # Does this mean: (a) list can be None, or (b) list can contain None items?
    ...

# ✅ CLEAR — use PEP 604 union syntax
def process(items: list[str] | None) -> None:
    # items can be None, but NOT contain None items
    ...

# ✅ CLEAR — if items can contain None
def process(items: list[str | None]) -> None:
    # items is always a list, but may contain None
    ...
```

**Cause:** `Optional[List[X]]` nests generics, making intent unclear.

**Fix:** Use `X | None` (PEP 604) syntax — clearer and more concise.

```python
# Modern Python (3.10+)
def get_config(key: str) -> str | None:
    ...

def process_data(data: dict[str, int | None]) -> None:
    # dict always exists, but values can be None
    ...
```
