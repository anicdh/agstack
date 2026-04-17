# FastAPI Gotchas

## 1. Forgetting `response_model` — Type Safety Lost

**Symptom:** Route returns a Pydantic model, but FastAPI doesn't validate/serialize it (no type checking, wrong fields leaked).

```python
# ❌ WRONG — no response_model
@router.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.get_user(user_id)
    return user  # Returns raw SQLAlchemy object, not validated

# Client gets: {"id": 1, "name": "John", "password_hash": "secret", ...}
# ^ password_hash leaked because no schema to filter it
```

**Cause:** Without `response_model`, FastAPI doesn't know which fields to serialize/validate.

**Fix:** Always specify `response_model` with a Pydantic schema.

```python
# ✅ CORRECT
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.get_user(user_id)
    return user

# Client gets: {"id": 1, "name": "John"}  ← Only fields in UserResponse schema
```

---

## 2. Wrong HTTP Status Code (Default 200 for Everything)

**Symptom:** POST endpoint returns 200 instead of 201 Created, DELETE returns 200 instead of 204 No Content.

```python
# ❌ WRONG — defaults to 200 OK
@router.post("/users", response_model=UserResponse)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    ...
    # Response: 200 OK (wrong — should be 201 Created)

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    ...
    # Response: 200 OK (wrong — should be 204 No Content)
```

**Cause:** FastAPI defaults to 200 for all successful responses unless explicitly set.

**Fix:** Set `status_code` parameter explicitly.

```python
# ✅ CORRECT
from fastapi import status

@router.post("/users", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user(...):
    ...  # 201 Created

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(...):
    ...  # 204 No Content
```

---

## 3. Dependency Not Injected (Missing `Depends()`)

**Symptom:** Route handler accepts `db: AsyncSession` parameter but gets `None` or wrong value.

```python
# ❌ WRONG — db is not injected, gets default value None
@router.get("/users")
async def list_users(db: AsyncSession = None):  # No Depends()!
    result = await db.execute(select(User))
    # TypeError: 'NoneType' object is not awaitable
```

**Cause:** Without `Depends()`, FastAPI treats the parameter as a normal function argument.

**Fix:** Always wrap dependency functions in `Depends()`.

```python
# ✅ CORRECT
@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    ...
```

---

## 4. Pydantic v1 Methods in v2 (parse_obj, dict vs model_dump)

**Symptom:** Code uses `UserResponse.parse_obj(user)` or `.dict()` which don't exist in Pydantic v2.

```python
# ❌ WRONG — Pydantic v1 API (doesn't work in v2)
user_response = UserResponse.parse_obj(user)  # AttributeError in v2
data = user_response.dict()  # Use model_dump() instead

# ✅ CORRECT — Pydantic v2 API
user_response = UserResponse.model_validate(user)
data = user_response.model_dump()
```

**Cause:** Pydantic v2 renamed methods for clarity and performance.

**Fix:** Update to v2 API; or let FastAPI serialize via `response_model`.

```python
# ✅ BEST — FastAPI handles serialization
@router.get("/", response_model=UserResponse)
async def get_user(...):
    user = await service.get_user(user_id)
    return user  # FastAPI auto-serializes using response_model
```

---

## 5. Circular Dependency in route -> service -> dependency

**Symptom:** Service requires `db: AsyncSession` as parameter, but route also uses `Depends(get_db)`, causing double injection.

```python
# ❌ WRONG — db passed twice
@router.get("/users")
async def get_users(
    db: AsyncSession = Depends(get_db),
):
    service = UserService(db)  # Passing db to service
    users = await service.list_users()

# In service:
class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list_users(self) -> list[User]:
        result = await self.db.execute(select(User))
        ...
```

**Cause:** Service should be dependency-agnostic; router manages injection.

**Fix:** Inject service via Depends factory, not `db` directly.

```python
# ✅ CORRECT
def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)

@router.get("/users")
async def get_users(
    service: UserService = Depends(get_user_service),
):
    users = await service.list_users()
```
