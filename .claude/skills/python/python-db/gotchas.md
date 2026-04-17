# SQLAlchemy & Database Gotchas

## 1. Forgetting `await db.commit()` — Changes Not Saved

**Symptom:** Code creates/updates model, but changes don't persist in database.

```python
# ❌ WRONG — forgot await and commit
async def create_user(db: AsyncSession, email: str):
    user = User(email=email)
    db.add(user)
    # Changes NOT committed to database!
    return user

# Query later shows user doesn't exist
```

**Cause:** `db.add()` stages changes in session, but doesn't save to database until `commit()`.

**Fix:** Always call `await db.commit()` after modifications.

```python
# ✅ CORRECT
async def create_user(db: AsyncSession, email: str):
    user = User(email=email)
    db.add(user)
    await db.commit()  # NOW saved to database
    await db.refresh(user)  # Refresh to get id, created_at
    return user
```

---

## 2. Missing `await` on Async Queries — Hangs or TypeError

**Symptom:** Query returns a coroutine instead of result; code hangs or crashes with `TypeError`.

```python
# ❌ WRONG — forgot await
async def get_user(db: AsyncSession, user_id: int):
    stmt = select(User).where(User.id == user_id)
    result = db.execute(stmt)  # Returns coroutine, not result!
    user = result.scalars().first()  # TypeError: object is not iterable

# ❌ WRONG — forgot await, assigned coroutine
result = db.execute(stmt)
# result is <coroutine object>
```

**Cause:** Async functions must be `await`ed to get the actual result.

**Fix:** Always `await db.execute()`.

```python
# ✅ CORRECT
async def get_user(db: AsyncSession, user_id: int):
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)  # NOW gets actual result
    user = result.scalars().first()
    return user
```

---

## 3. Forgetting `await db.refresh()` — Missing Generated Columns

**Symptom:** After creating model, `id`, `created_at` are `None`.

```python
# ❌ WRONG — no refresh
async def create_user(db: AsyncSession, email: str):
    user = User(email=email)
    db.add(user)
    await db.commit()
    # user.id is None (not refreshed from database)
    return user

# Result has id=None, created_at=None
```

**Cause:** Generated columns (`id`, `created_at`) are created by database, not Python. Need to refresh to fetch them.

**Fix:** Call `await db.refresh()` after commit.

```python
# ✅ CORRECT
async def create_user(db: AsyncSession, email: str):
    user = User(email=email)
    db.add(user)
    await db.commit()
    await db.refresh(user)  # Fetch auto-generated columns from DB
    return user

# Now user.id and user.created_at are populated
```

---

## 4. Separate Commits for Related Operations — Lost Atomicity

**Symptom:** Multi-step operation (like money transfer) partially succeeds: first commit succeeds, second fails, leaving inconsistent state.

```python
# ❌ WRONG — separate commits
async def transfer_credits(db: AsyncSession, from_id: int, to_id: int, amount: int):
    from_user = await get_user(db, from_id)
    from_user.balance -= amount
    await db.commit()  # Commit 1: from_user balance reduced
    
    to_user = await get_user(db, to_id)
    to_user.balance += amount
    await db.commit()  # Commit 2: FAILS — money vanished!
    
# If commit 2 fails: from_user lost money, to_user didn't receive it

```

**Cause:** Transactions ensure all-or-nothing; splitting commits breaks atomicity.

**Fix:** Single commit for all related changes.

```python
# ✅ CORRECT
async def transfer_credits(db: AsyncSession, from_id: int, to_id: int, amount: int):
    try:
        from_user = await get_user(db, from_id)
        to_user = await get_user(db, to_id)
        
        from_user.balance -= amount
        to_user.balance += amount
        
        await db.commit()  # Single commit — all or nothing
    except Exception:
        await db.rollback()  # Rollback if any step fails
        raise
```

---

## 5. Using `.query()` Instead of `select()` (Old SQLAlchemy 1.4)

**Symptom:** Code uses `.query(Model)` which doesn't work well with async.

```python
# ❌ WRONG — old .query() API (SQLAlchemy 1.4)
users = await db.query(User).filter(User.is_active == True).all()
# Doesn't work well with async, deprecated

# ❌ WRONG — mixing old and new
result = db.query(User).where(User.is_active == True)
await result  # Doesn't make sense
```

**Cause:** SQLAlchemy 2.0 changed to `select()` API which works better with async/await.

**Fix:** Use `select()` API for all queries.

```python
# ✅ CORRECT — modern select() API
stmt = select(User).where(User.is_active == True)
result = await db.execute(stmt)
users = result.scalars().all()
```

---

## 6. Stale Objects After Commit (expire_on_commit=True Default)

**Symptom:** After commit, model attributes become stale; accessing them triggers lazy load (which fails in async).

```python
# ❌ WRONG — object becomes lazy-loaded after commit
async def create_and_use(db: AsyncSession, email: str):
    user = User(email=email)
    db.add(user)
    await db.commit()  # By default, user is now expired
    print(user.name)  # ❌ LAZY LOAD — blocks event loop!
```

**Cause:** SQLAlchemy expires objects after commit to keep them fresh. Lazy loading doesn't work in async.

**Fix:** Use `expire_on_commit=False` or refresh immediately.

```python
# ✅ CORRECT — Option 1: refresh immediately
await db.commit()
await db.refresh(user)
print(user.name)  # Now loaded

# ✅ CORRECT — Option 2: expire_on_commit=False in session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```
