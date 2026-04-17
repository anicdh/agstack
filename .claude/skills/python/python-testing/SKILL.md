---
name: python-testing
description: >
  Use when writing pytest tests, creating fixtures, using parametrize,
  mocking dependencies, and testing async code with httpx.AsyncClient.
  Covers test structure, conftest.py fixtures, and async testing patterns.
  ALWAYS read python-dev first.
invocation: auto
---

# Pytest & Testing Patterns

> **Prerequisites:** Read `python-dev` first. This skill covers testing structure, fixtures, and async test patterns.

## Test Structure

### Project Layout

```
backend-python/
├── app/
│   ├── models.py
│   ├── routers.py
│   └── services.py
├── tests/
│   ├── conftest.py              — Shared fixtures
│   ├── test_models.py           — Unit tests for models
│   ├── test_services.py         — Unit tests for services
│   ├── test_routers.py          — Integration tests for API
│   └── fixtures/
│       └── sample_data.py       — Test data builders
```

**Rules:**
- Test file names: `test_*.py` or `*_test.py`
- One test module per app module
- Fixtures in `conftest.py` (shared across tests)
- Test data builders in `fixtures/` subdirectory

## Fixtures (conftest.py)

### Basic Fixtures

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.db.engine import AsyncSessionLocal
from app.db.deps import get_db

@pytest.fixture
async def db():
    """Provide test database session."""
    # Create in-memory SQLite for testing
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    
    # Create tables
    async with engine.begin() as conn:
        from app.models import Base
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session_local = async_sessionmaker(engine, class_=AsyncSession)
    async with async_session_local() as session:
        yield session
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def client(db: AsyncSession):
    """Provide FastAPI test client with mocked database."""
    # Override get_db dependency
    async def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    # Cleanup
    app.dependency_overrides.clear()

@pytest.fixture
def mock_settings():
    """Provide mock settings for tests."""
    from app.config import Settings
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        debug=True,
        api_key="test-key",
    )
```

### Parametrized Fixtures

```python
@pytest.fixture(
    params=[
        {"email": "user1@example.com", "name": "User 1"},
        {"email": "user2@example.com", "name": "User 2"},
    ]
)
def user_data(request):
    """Provide different user data for parametrized tests."""
    return request.param

# Test using parametrized fixture:
@pytest.mark.anyio
async def test_create_user_with_different_data(user_data, db):
    """Test user creation with multiple inputs."""
    service = UserService(db)
    user = await service.create_user(user_data["name"], user_data["email"])
    assert user.email == user_data["email"]
```

## Unit Tests

### Testing Services

```python
# tests/test_services.py
import pytest
from app.services.users import UserService
from app.errors import NotFoundError, BadRequestError

@pytest.mark.anyio
async def test_create_user(db):
    """Test user creation."""
    service = UserService(db)
    user = await service.create_user("John", "john@example.com")
    
    assert user.name == "John"
    assert user.email == "john@example.com"
    assert user.id is not None

@pytest.mark.anyio
async def test_create_user_duplicate_email(db):
    """Test that duplicate emails are rejected."""
    service = UserService(db)
    await service.create_user("John", "john@example.com")
    
    with pytest.raises(BadRequestError):
        await service.create_user("Jane", "john@example.com")

@pytest.mark.anyio
async def test_get_user_not_found(db):
    """Test retrieving non-existent user."""
    service = UserService(db)
    
    with pytest.raises(NotFoundError):
        await service.get_user(999)

# ✅ CORRECT — using pytest.raises for exception testing
# ❌ WRONG — try/except in test
def test_error_handling_wrong():
    try:
        service.get_user(999)
    except NotFoundError:
        pass  # Don't do this
```

## Integration Tests (Routers)

### Testing API Endpoints

```python
# tests/test_routers.py
import pytest
from httpx import AsyncClient

@pytest.mark.anyio
async def test_create_user_endpoint(client: AsyncClient, db):
    """Test POST /users endpoint."""
    response = await client.post(
        "/users",
        json={"name": "John", "email": "john@example.com"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "John"
    assert data["email"] == "john@example.com"
    assert "id" in data

@pytest.mark.anyio
async def test_get_user_endpoint(client: AsyncClient, db):
    """Test GET /users/{user_id} endpoint."""
    # First, create a user
    create_response = await client.post(
        "/users",
        json={"name": "John", "email": "john@example.com"},
    )
    user_id = create_response.json()["id"]
    
    # Then fetch it
    response = await client.get(f"/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["id"] == user_id

@pytest.mark.anyio
async def test_user_not_found_404(client: AsyncClient):
    """Test 404 response for non-existent user."""
    response = await client.get("/users/999")
    assert response.status_code == 404
    assert response.json()["message"] == "User 999 not found"

# ✅ CORRECT — test for specific status code
# ❌ WRONG — just checking status_code without assertion
def test_endpoint_wrong():
    response = client.get("/users/1")
    status = response.status_code  # Not asserting!
```

## Parametrize Tests

### Multiple Test Cases

```python
import pytest

@pytest.mark.anyio
@pytest.mark.parametrize(
    "name,email,expected_status",
    [
        ("John", "john@example.com", 201),
        ("Jane", "jane@example.com", 201),
        ("", "empty@example.com", 400),  # Empty name
        ("Bob", "invalid-email", 400),    # Invalid email
    ],
)
async def test_create_user_various_inputs(client, name, email, expected_status):
    """Test user creation with various inputs."""
    response = await client.post(
        "/users",
        json={"name": name, "email": email},
    )
    assert response.status_code == expected_status

# Using pytest.param for more control:
@pytest.mark.parametrize(
    "amount,expected",
    [
        pytest.param(100, 100, id="valid amount"),
        pytest.param(-50, None, id="negative amount rejected"),
        pytest.param(0, None, id="zero amount rejected"),
    ],
)
async def test_transfer_credits(amount, expected, db):
    """Test credit transfer with various amounts."""
    service = UserService(db)
    result = await service.transfer_credits(1, 2, amount)
    assert result == expected
```

## Mocking

### Mock External Dependencies

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.anyio
async def test_send_welcome_email(db):
    """Test sending welcome email (mock external service)."""
    with patch("app.services.email.send_email", new_callable=AsyncMock) as mock_send:
        service = UserService(db)
        user = await service.create_user("John", "john@example.com")
        
        # Assert email was sent
        mock_send.assert_called_once()
        args, kwargs = mock_send.call_args
        assert "john@example.com" in str(args)

@pytest.mark.anyio
async def test_fetch_external_api(db):
    """Test service that calls external API (mock the HTTP call)."""
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value.json.return_value = {"id": 1, "name": "External Data"}
        
        service = ExternalService(db)
        result = await service.fetch_data()
        
        assert result["name"] == "External Data"
        mock_get.assert_called_once()
```

## Async Test Configuration

### pytest.ini / pyproject.toml

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
markers = [
    "anyio: mark test as async (using anyio plugin)",
    "integration: mark test as integration test",
    "slow: mark test as slow",
]

# Or use:
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
```

### Marking Async Tests

```python
import pytest

# ✅ CORRECT — mark async tests
@pytest.mark.anyio
async def test_async_operation():
    """Async test function."""
    result = await some_async_function()
    assert result

# ✅ CORRECT — skip test conditionally
@pytest.mark.skipif(
    not HAS_POSTGRES,
    reason="PostgreSQL not available",
)
async def test_postgresql_feature():
    ...
```

## Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run only unit tests (fast)
pytest tests/ -m "not integration"

# Run specific test
pytest tests/test_services.py::test_create_user

# Run tests matching pattern
pytest tests/ -k "user"

# Run with verbose output
pytest tests/ -v

# Stop on first failure
pytest tests/ -x
```

## Implementation Checklist

Before submitting test code:

- [ ] Test file names match `test_*.py` pattern
- [ ] Each test has docstring explaining what it tests
- [ ] Async tests marked with `@pytest.mark.anyio`
- [ ] Fixtures in `conftest.py` for shared setup/teardown
- [ ] Database tests use test database (not production)
- [ ] Mocks/patches used for external dependencies
- [ ] Tests use `pytest.raises()` for exception testing
- [ ] Parametrized tests for multiple input variations
- [ ] All tests are independent (no test order dependency)
- [ ] Setup/teardown cleanup (fixtures clean up after themselves)

## Before Commit

```bash
# Run all tests
pytest tests/ -v

# Check coverage
pytest tests/ --cov=app --cov-report=term-missing

# Type check test code
mypy --strict tests/
```
