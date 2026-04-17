# Pydantic Schemas Gotchas

## 1. Using Pydantic v1 API in v2 (parse_obj, .dict(), orm_mode)

**Symptom:** Code uses `parse_obj()`, `.dict()`, or `orm_mode=True`, which don't exist in Pydantic v2.

```python
# ❌ WRONG — Pydantic v1 API (doesn't work in v2)
from pydantic import BaseModel

class UserResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        orm_mode = True  # v1 API, deprecated

# Using v1 methods:
user = UserResponse.parse_obj(orm_object)  # AttributeError in v2
user_dict = user.dict()                     # Use model_dump() instead
```

**Cause:** Pydantic v2 renamed methods for clarity and performance.

**Fix:** Use v2 API: `ConfigDict(from_attributes=True)`, `model_validate()`, `model_dump()`.

```python
# ✅ CORRECT — Pydantic v2 API
from pydantic import BaseModel, ConfigDict

class UserResponse(BaseModel):
    id: int
    name: str
    
    model_config = ConfigDict(from_attributes=True)  # v2

# Using v2 methods:
user = UserResponse.model_validate(orm_object)  # Validate ORM object
user_dict = user.model_dump()                    # Convert to dict
user_json = user.model_dump_json()               # Convert to JSON
```

---

## 2. Forgetting `from_attributes=True` — ORM Fields Not Serialized

**Symptom:** Response model receives SQLAlchemy ORM object, but some fields are missing or null.

```python
# ❌ WRONG — no from_attributes
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    # Missing: model_config = ConfigDict(from_attributes=True)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)  # SQLAlchemy object
    return user  # Fields fail to serialize — returns incomplete data

# ✅ CORRECT — with from_attributes
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    
    model_config = ConfigDict(from_attributes=True)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    return user  # Now all fields serialize correctly
```

**Cause:** Without `from_attributes=True`, Pydantic doesn't know how to read attributes from ORM objects.

**Fix:** Add `model_config = ConfigDict(from_attributes=True)` to response models.

---

## 3. Request Model Mutating User Input (Validation Side Effects)

**Symptom:** Validator modifies input value, causing unexpected mutations.

```python
# ❌ WRONG — validator mutates field
class UserCreate(BaseModel):
    name: str
    email: str
    
    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return v.replace("<", "").replace(">", "")  # Mutates input!

# Input: {"name": "<script>alert('xss')</script>", "email": "..."}
# Result: {"name": "scriptalertxssscript", "email": "..."}
# Original intent (strip HTML) may have unintended side effects
```

**Cause:** Validators transform values, which is sometimes unintended.

**Fix:** Sanitize/normalize only when appropriate; document intent clearly.

```python
# ✅ CORRECT — intentional normalization
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    
    @field_validator("name")
    @classmethod
    def normalize_whitespace(cls, v: str) -> str:
        """Normalize whitespace (intentional normalization)."""
        return " ".join(v.split())
    
    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Email addresses are case-insensitive; normalize to lowercase."""
        return v.lower()
```

---

## 4. Validation Runs Even on Optional Fields (None Passes Through)

**Symptom:** Optional field with validator always validates, even when value is None.

```python
# ❌ WRONG — validator runs on None values
class UserUpdate(BaseModel):
    age: int | None = None
    
    @field_validator("age")
    @classmethod
    def age_must_be_positive(cls, v: int) -> int:
        if v < 0:  # TypeError if v is None!
            raise ValueError("Age must be positive")
        return v

# Input: {"age": None} → Validator runs, crashes!

# ✅ CORRECT — skip validation for None
@field_validator("age", mode="before")
@classmethod
def age_must_be_positive(cls, v):
    if v is None:
        return v  # Skip validation for None
    if v < 0:
        raise ValueError("Age must be positive")
    return v
```

**Cause:** By default, validators run on all values (including None).

**Fix:** Explicitly handle `None` in validator, or use `Field(default=None)`.

---

## 5. Settings Not Loading from Environment — Always Using Defaults

**Symptom:** Settings class defined but environment variables not loaded; all settings use defaults.

```python
# ❌ WRONG — Settings not reading from environment
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///default.db"  # Default
    debug: bool = False

# ENV: DATABASE_URL="postgresql://prod"
settings = Settings()
print(settings.database_url)  # Still "sqlite:///default.db" — not loaded!

# ✅ CORRECT — read from environment
class Settings(BaseSettings):
    database_url: str  # Required (no default)
    debug: bool = False
    
    class Config:
        env_file = ".env"

# Settings instantiation tries to read from environment
# If DATABASE_URL not set, raises validation error
settings = Settings()
```

**Cause:** Settings doesn't read from environment unless fields are defined without defaults.

**Fix:** Make env-loaded fields required (no default), or ensure `.env` file exists with values.

---

## 6. Not Excluding Sensitive Fields in Response Models

**Symptom:** Response model includes password_hash, api_key, or other secrets.

```python
# ❌ WRONG — exposes sensitive fields
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    password_hash: str  # NEVER expose!
    api_key: str        # NEVER expose!
    
    model_config = ConfigDict(from_attributes=True)

# API response includes password_hash and api_key (security risk!)

# ✅ CORRECT — exclude sensitive fields
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    # Omit: password_hash, api_key
    
    model_config = ConfigDict(from_attributes=True)

# Or explicitly exclude via model_dump():
@router.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    return user.model_dump(exclude={"password_hash", "api_key"})
```

**Cause:** Developers forget to exclude sensitive fields from response schemas.

**Fix:** Only include safe fields in response models, omit secrets by default.
