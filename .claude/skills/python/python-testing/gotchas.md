# Pytest & Testing Gotchas

## 1. Forgetting `@pytest.mark.anyio` on Async Tests — Test Never Runs

**Symptom:** Async test defined but never executes; pytest reports "no tests collected" or test passes without running code.

```python
# ❌ WRONG — async test without @pytest.mark.anyio
async def test_fetch_user(db):
    """This test is never actually executed."""
    user = await service.get_user(1)
    assert user.id == 1

# pytest output: "1 passed" but the code inside never ran!

# ✅ CORRECT — mark async test
@pytest.mark.anyio
async def test_fetch_user(db):
    """This test runs correctly."""
    user = await service.get_user(1)
    assert user.id == 1
```

**Cause:** Pytest doesn't know how to run async tests without the `@pytest.mark.anyio` marker (requires pytest-anyio plugin).

**Fix:** Mark all async test functions with `@pytest.mark.anyio`.

```python
@pytest.mark.anyio
async def test_something():
    ...
```

---

## 2. Tests Using Production Database — Data Corruption

**Symptom:** Tests read/write to real database; test data pollutes production; tests interfere with each other.

```python
# ❌ WRONG — using real database
@pytest.fixture
def db():
    """Uses real database (DANGEROUS!)."""
    return AsyncSessionLocal()  # Connects to production DB

# ✅ CORRECT — use test database
@pytest.fixture
async def db():
    """In-memory SQLite for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    async with async_session() as session:
        yield session
```

**Cause:** Developers forget to override database URL in tests.

**Fix:** Use in-memory SQLite or test database for all tests.

---

## 3. Test Order Dependency — Passing Tests Become Failing

**Symptom:** Tests pass individually but fail when run together; order matters.

```python
# ❌ WRONG — tests depend on each other
@pytest.mark.anyio
async def test_user_created():
    user = await service.create_user("john@example.com")
    assert user.id == 1

@pytest.mark.anyio
async def test_user_exists():
    user = await service.get_user(1)  # Assumes user created by previous test!
    assert user.email == "john@example.com"

# Running individually: both pass
# Running together: test_user_exists fails (user doesn't exist)
```

**Cause:** Tests share state (database); second test assumes first test ran first.

**Fix:** Each test should be independent, set up its own data.

```python
# ✅ CORRECT — independent tests
@pytest.mark.anyio
async def test_user_creation(db):
    """Test creating a user."""
    service = UserService(db)
    user = await service.create_user("john@example.com")
    assert user.id is not None

@pytest.mark.anyio
async def test_user_retrieval(db):
    """Test retrieving a user (with setup)."""
    service = UserService(db)
    created = await service.create_user("jane@example.com")
    retrieved = await service.get_user(created.id)
    assert retrieved.email == "jane@example.com"
```

---

## 4. Not Cleaning Up After Tests — Resource Leaks

**Symptom:** Tests leave behind data/files; subsequent tests fail; database connections not closed.

```python
# ❌ WRONG — no cleanup
@pytest.fixture
def db():
    engine = create_async_engine("sqlite:///:memory:")
    session = AsyncSessionLocal()
    yield session
    # Missing cleanup!

# Files left behind, connections unclosed

# ✅ CORRECT — with cleanup
@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    async with async_session() as session:
        yield session  # Cleanup happens after yield
    
    # Explicitly drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
```

**Cause:** Fixtures don't clean up resources after test completes.

**Fix:** Use `yield` in fixtures for setup/teardown, or context managers.

---

## 5. Mocking Wrong Object (Patch Import Path Incorrect)

**Symptom:** Mock doesn't work; code still calls real function instead of mock.

```python
# ❌ WRONG — patching the wrong path
from app.services.email import send_email

@patch("app.services.email.send_email")  # WRONG PATH
def test_user_creation(mock_send, db):
    service = UserService(db)
    user = await service.create_user("john@example.com")
    # mock_send was never called — the real send_email ran!

# ✅ CORRECT — patch where the function is used
@patch("app.services.users.send_email")  # Patch in UserService module
async def test_user_creation(mock_send, db):
    service = UserService(db)
    user = await service.create_user("john@example.com")
    mock_send.assert_called_once()
```

**Cause:** Patch must target where function is *imported*, not where it's defined.

**Fix:** Patch at usage site: `@patch("module_that_uses_function.function_name")`.

---

## 6. Not Using `assert` Correctly — Test Doesn't Verify Anything

**Symptom:** Test runs without assertions, so failures go undetected.

```python
# ❌ WRONG — no assertion
@pytest.mark.anyio
async def test_create_user(db):
    service = UserService(db)
    user = await service.create_user("john@example.com")
    # No assertion! Test always passes

# ❌ WRONG — assertion in wrong place
def test_value():
    result = 5 + 5
    if result == 10:
        print("OK")  # Don't use print!

# ✅ CORRECT
@pytest.mark.anyio
async def test_create_user(db):
    service = UserService(db)
    user = await service.create_user("john@example.com")
    assert user.email == "john@example.com"  # Explicit assertion
    assert user.id is not None
```

**Cause:** Forgetting to add `assert` statements after calling the code under test.

**Fix:** Every test must have at least one `assert`.
