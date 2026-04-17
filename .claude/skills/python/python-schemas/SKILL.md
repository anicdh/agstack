---
name: python-schemas
description: >
  Use when defining Pydantic BaseModel schemas, validation, ConfigDict,
  custom validators, and Settings classes. Covers Pydantic v2 patterns
  for request/response models and configuration management.
  ALWAYS read python-dev first.
invocation: auto
---

# Pydantic v2 Schemas & Validation

> **Prerequisites:** Read `python-dev` first. This skill covers Pydantic models, validation, and settings.

## Request/Response Models

### Basic Request Model

```python
from pydantic import BaseModel, EmailStr, Field

# ✅ CORRECT — request model with validation
class UserCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
        description="User's full name",
    )
    email: EmailStr = Field(description="User's email address")
    age: int | None = Field(None, ge=0, le=150, description="User's age (optional)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john@example.com",
                "age": 30,
            }
        }

# ❌ WRONG — no validation
class UserCreate(BaseModel):
    name: str
    email: str
    age: int
```

**Validation rules:**
- `Field(min_length=1)` — string must not be empty
- `Field(max_length=255)` — string max length
- `EmailStr` — valid email format (from pydantic)
- `Field(ge=0, le=150)` — integer between 0-150
- `Field(...)` — required, `Field(default=None)` — optional

### Response Model with from_attributes

```python
from pydantic import BaseModel, ConfigDict
from datetime import datetime

# ✅ CORRECT — response model from ORM (Pydantic v2)
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Usage in FastAPI:
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    return user  # Pydantic auto-serializes ORM object

# ❌ WRONG — Pydantic v1 API
class UserResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        orm_mode = True  # v1, deprecated in v2
```

**Rules:**
- ALWAYS use `ConfigDict(from_attributes=True)` to serialize ORM objects
- Response models should be read-only (include only fields safe to expose)
- Request models have business rules (validation, constraints)

## Custom Validators

### Field Validators (Pydantic v2)

```python
from pydantic import BaseModel, field_validator, EmailStr, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8)
    
    @field_validator("name")
    @classmethod
    def name_must_not_be_empty_string(cls, v: str) -> str:
        """Validate name is not just whitespace."""
        if not v.strip():
            raise ValueError("Name cannot be whitespace only")
        return v.strip()
    
    @field_validator("password")
    @classmethod
    def password_must_have_special_char(cls, v: str) -> str:
        """Validate password has special character."""
        if not any(c in "!@#$%^&*" for c in v):
            raise ValueError("Password must contain special character")
        return v
    
    @field_validator("email")
    @classmethod
    def email_must_be_lowercase(cls, v: str) -> str:
        """Normalize email to lowercase."""
        return v.lower()

# ✅ CORRECT — validate multiple fields together
class DateRange(BaseModel):
    start_date: datetime
    end_date: datetime
    
    @field_validator("end_date")
    @classmethod
    def end_date_must_be_after_start(cls, v: datetime, info):
        """Validate end_date > start_date."""
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v

# ❌ WRONG — Pydantic v1 validator (deprecated)
class UserCreate(BaseModel):
    name: str
    
    @validator("name")
    def name_not_empty(cls, v):
        ...
```

**Rules:**
- Use `@field_validator` for single-field validation (Pydantic v2)
- Use `@classmethod` with validators
- Raise `ValueError` with message for validation error
- Access other fields via `info.data` for cross-field validation
- NEVER use v1 `@validator` decorator

## Model Validation & Serialization

### Validation & Conversion

```python
from pydantic import BaseModel, field_validator, model_validator

class User(BaseModel):
    name: str
    email: str
    is_active: bool = True
    
    # Field-level validation
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid email")
        return v.lower()
    
    # Model-level validation (after all fields)
    @model_validator(mode="after")
    def validate_model(self):
        """Validate entire model after construction."""
        if not self.name and not self.is_active:
            raise ValueError("Active users must have name")
        return self

# ✅ CORRECT — parse and validate
user_data = {
    "name": "John",
    "email": "JOHN@EXAMPLE.COM",
    "is_active": True,
}
user = User(**user_data)  # Validates, normalizes email to lowercase

# ✅ CORRECT — v2 model validation
user = User.model_validate(user_data)  # v2: model_validate
user_dict = user.model_dump()          # v2: model_dump
user_json = user.model_dump_json()     # v2: model_dump_json

# ❌ WRONG — Pydantic v1 API
user = User.parse_obj(user_data)  # Deprecated in v2
user_dict = user.dict()           # Use model_dump() instead
```

## Settings & Configuration

### Pydantic Settings for Environment Variables

```python
from pydantic_settings import BaseSettings
from pydantic import Field

# ✅ CORRECT — centralized settings with env file
class Settings(BaseSettings):
    """Application settings from environment variables."""
    database_url: str
    redis_url: str = "redis://localhost:6379"
    debug: bool = False
    api_key: str
    jwt_secret: str
    jwt_expires_in: int = 3600
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Usage:
# settings = Settings()  # Loads from .env file or environment

# .env file
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db
# REDIS_URL=redis://localhost:6379
# DEBUG=false
# API_KEY=secret-key
# JWT_SECRET=jwt-secret

# ❌ WRONG — hardcoded values
class Settings:
    DATABASE_URL = "postgresql://user:pass@localhost/db"
    DEBUG = False
```

### Validation in Settings

```python
from pydantic import BaseSettings, Field, field_validator

class Settings(BaseSettings):
    """Settings with validation."""
    database_url: str = Field(description="PostgreSQL connection URL")
    redis_url: str = Field(default="redis://localhost:6379")
    api_key: str = Field(min_length=1, description="API key for external service")
    port: int = Field(8000, ge=1, le=65535)
    
    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure database URL is valid."""
        if not v.startswith(("postgresql", "mysql", "sqlite")):
            raise ValueError("Invalid database URL")
        return v
    
    class Config:
        env_file = ".env"

# Settings are validated at instantiation:
# settings = Settings()  # Raises error if any field invalid
```

### Using Settings in FastAPI

```python
from fastapi import FastAPI, Depends
from app.config import Settings

app = FastAPI()

def get_settings() -> Settings:
    """Dependency to inject settings."""
    return Settings()

@app.get("/config")
async def get_config(settings: Settings = Depends(get_settings)):
    """Get configuration (don't expose secrets!)."""
    return {
        "debug": settings.debug,
        "port": settings.port,
    }
```

## Advanced Patterns

### Optional Fields vs Required

```python
from pydantic import BaseModel, Field

class UserUpdate(BaseModel):
    """Partial update — only some fields can be updated."""
    name: str | None = Field(None, min_length=1, max_length=255)
    email: str | None = Field(None, pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    age: int | None = Field(None, ge=0, le=150)

# Usage:
update_data = {"name": "Jane"}  # Only update name
user.name = update_data.get("name") or user.name

# ❌ WRONG — Optional doesn't mean not validated
class UserUpdate(BaseModel):
    name: Optional[str]  # Still validated! (not optional in validation sense)
    email: Optional[str]
```

### Computed Fields

```python
from pydantic import BaseModel, computed_field

class User(BaseModel):
    first_name: str
    last_name: str
    
    @computed_field
    @property
    def full_name(self) -> str:
        """Compute full name from first and last."""
        return f"{self.first_name} {self.last_name}"

# Usage:
user = User(first_name="John", last_name="Doe")
print(user.full_name)  # "John Doe"
```

## Implementation Checklist

Before submitting schema code:

- [ ] Request models have validation (`Field()`, validators)
- [ ] Response models use `ConfigDict(from_attributes=True)`
- [ ] Custom validators use `@field_validator` (not v1 `@validator`)
- [ ] Settings centralized in `app/config.py`
- [ ] Environment variables loaded from `.env` via Settings
- [ ] No hardcoded configuration values
- [ ] Validation error messages are clear and helpful
- [ ] Cross-field validation using `info.data` if needed
- [ ] Pydantic v2 API: `model_validate()`, `model_dump()`, not v1

## Before Commit

```bash
# Type check schemas
mypy --strict app/schemas/

# Test schema validation
pytest tests/test_schemas.py -v

# Check for v1 API usage
grep -r "parse_obj\|\.dict()\|orm_mode" app/schemas/ --include="*.py"
```
