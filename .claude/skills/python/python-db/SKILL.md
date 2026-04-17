---
name: python-db
description: >
  Use when querying databases, writing SQLAlchemy models, creating Alembic migrations,
  or managing transactions. Covers async SQLAlchemy 2.0, declarative models, queries,
  and transaction patterns.
  ALWAYS read python-dev first.
invocation: auto
---

# SQLAlchemy Async & Alembic Patterns

> **Prerequisites:** Read `python-dev` first. This skill covers models, queries, transactions, and migrations.

## Database Setup (Engine & Session Factory)

### app/db/engine.py

```python
# ✅ CORRECT — async engine with session factory
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

# Async PostgreSQL engine (use asyncpg driver)
engine = create_async_engine(
    settings.database_url,  # e.g., "postgresql+asyncpg://user:pass@localhost/db"
    echo=settings.debug,
    pool_size=10,
    max_overflow=20,
)

# Session factory for creating sessions
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ❌ WRONG — sync database with blocking driver
from sqlalchemy import create_engine
engine = create_engine("postgresql://user:pass@localhost/db")
Session = sessionmaker(bind=engine)
```

**Rules:**
- ALWAYS use async driver: `postgresql+asyncpg://...`
- NEVER use sync driver in async context
- Configure `pool_size` and `max_overflow` for production
- Create engine ONCE at app startup

## SQLAlchemy Models (Declarative)

### app/models/base.py — Common Columns

```python
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, func
from sqlalchemy.orm import DeclarativeBase

# ✅ CORRECT — base with common columns
class Base(DeclarativeBase):
    """Base class for all models."""
    pass

class TimestampMixin:
    """Mixin for created_at and updated_at."""
    created_at: datetime = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at: datetime = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

class IdMixin:
    """Mixin for id primary key."""
    id: int = Column(Integer, primary_key=True)
```

### app/models/user.py — Domain Model

```python
from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, IdMixin, TimestampMixin
from datetime import datetime

# ✅ CORRECT — model with all columns explicit
class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"

# ❌ WRONG — no __tablename__, missing type annotations
class User(Base):
    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String)
```

**Rules:**
- ALWAYS set `__tablename__` explicitly
- ALWAYS use type annotations with `Mapped[]`
- ALWAYS use `mapped_column()` for columns
- ALWAYS inherit from `Base`
- Common columns: `id`, `created_at`, `updated_at`
- Add indexes on frequently queried columns (`email`, `username`)

## Async Queries

### Query Patterns

```python
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

# ✅ CORRECT — select() API (SQLAlchemy 2.0+)
async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Fetch user by email."""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalars().first()
    return user

# ✅ CORRECT — multiple results
async def list_active_users(db: AsyncSession) -> list[User]:
    """Fetch all active users."""
    stmt = select(User).where(User.is_active == True).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users

# ✅ CORRECT — filter with AND/OR
async def search_users(db: AsyncSession, query: str) -> list[User]:
    """Search users by name or email."""
    search_term = f"%{query}%"
    stmt = select(User).where(
        or_(
            User.name.ilike(search_term),
            User.email.ilike(search_term),
        )
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# ❌ WRONG — old ORM API (SQLAlchemy 1.4)
users = db.query(User).filter(User.is_active == True).all()

# ❌ WRONG — mixing sync/async
result = db.execute(stmt)  # Missing await
```

**Rules:**
- ALWAYS use `select()` API, not `.query()`
- ALWAYS `await db.execute()`
- Use `.scalars()` to extract model objects
- Use `.first()` for single result, `.all()` for multiple
- NEVER skip `await` — causes hang or error

### Count & Exists

```python
from sqlalchemy import func

# ✅ CORRECT — count users
async def count_users(db: AsyncSession) -> int:
    stmt = select(func.count(User.id))
    result = await db.execute(stmt)
    count = result.scalar()
    return count

# ✅ CORRECT — check if user exists
async def user_exists(db: AsyncSession, email: str) -> bool:
    stmt = select(select(User).where(User.email == email).exists())
    result = await db.execute(stmt)
    return result.scalar()

# ❌ WRONG — fetching all then counting (inefficient)
users = await db.execute(select(User))
count = len(users.scalars().all())
```

## Create, Update, Delete

### Create

```python
# ✅ CORRECT — create with commit
async def create_user(
    db: AsyncSession,
    name: str,
    email: str,
    password_hash: str,
) -> User:
    """Create a new user."""
    user = User(name=name, email=email, password_hash=password_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)  # Refresh to get id, created_at, etc.
    return user

# ❌ WRONG — forgot to commit
user = User(name=name, email=email)
db.add(user)
# Changes NOT saved to database
```

### Update

```python
# ✅ CORRECT — fetch, update, commit
async def update_user(
    db: AsyncSession,
    user_id: int,
    name: str | None = None,
) -> User | None:
    """Update user details."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        return None
    
    if name:
        user.name = name
    
    await db.commit()
    await db.refresh(user)
    return user

# ❌ WRONG — using execute() to update (inefficient)
await db.execute(
    update(User).where(User.id == user_id).values(name=name)
)
```

### Delete

```python
# ✅ CORRECT — fetch and delete
async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """Delete user by id."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        return False
    
    await db.delete(user)
    await db.commit()
    return True
```

## Transactions (Multi-Step Operations)

### Transaction with Rollback

```python
# ✅ CORRECT — transaction with rollback on error
async def transfer_credits(
    db: AsyncSession,
    from_user_id: int,
    to_user_id: int,
    amount: int,
) -> bool:
    """Transfer credits between users."""
    try:
        # Fetch both users
        from_result = await db.execute(select(User).where(User.id == from_user_id))
        from_user = from_result.scalars().first()
        
        to_result = await db.execute(select(User).where(User.id == to_user_id))
        to_user = to_result.scalars().first()
        
        if not from_user or not to_user:
            return False
        
        # Update balances
        from_user.balance -= amount
        to_user.balance += amount
        
        # Commit both changes atomically
        await db.commit()
        return True
    except Exception as e:
        await db.rollback()
        raise

# ❌ WRONG — separate commits (not atomic)
from_user.balance -= amount
await db.commit()
to_user.balance += amount
await db.commit()  # If this fails, transfer is incomplete
```

**Rules:**
- All multi-step operations in single transaction
- Use `try/except` with `await db.rollback()` on error
- Single `await db.commit()` at the end

## Alembic Migrations

### Initialize Migrations

```bash
# ✅ CORRECT — initialize Alembic
cd backend-python
alembic init migrations

# Update alembic.ini
sqlalchemy.url = postgresql+asyncpg://user:pass@localhost/db
```

### Create Migration

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add users table"

# Manual migration
alembic revision -m "Add is_verified column to users"
```

### Migration File Structure

```python
# migrations/versions/xxx_add_users_table.py
from alembic import op
import sqlalchemy as sa

# ✅ CORRECT
def upgrade() -> None:
    """Add users table."""
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

def downgrade() -> None:
    """Drop users table."""
    op.drop_table("users")
```

### Run Migrations

```bash
# ✅ CORRECT
alembic upgrade head    # Apply latest migrations
alembic upgrade +1      # Apply next migration
alembic downgrade -1    # Rollback last migration
alembic current         # Show current revision
```

**Rules:**
- Auto-generate migrations: `alembic revision --autogenerate`
- Always write `downgrade()` for rollback support
- Never hardcode data in migrations (use separate seeding scripts)
- Commit migration files to git

## Implementation Checklist

Before submitting database code:

- [ ] Models inherit from `Base` with explicit `__tablename__`
- [ ] All columns use `mapped_column()` with type annotations
- [ ] Common columns: `id`, `created_at`, `updated_at`
- [ ] Indexes on frequently queried columns (`email`, `username`)
- [ ] All queries use `select()` API, not `.query()`
- [ ] All async queries have `await db.execute()`
- [ ] Create/update/delete operations call `await db.commit()`
- [ ] Multi-step operations wrapped in transactions with rollback
- [ ] Migration files committed to git with `upgrade()` and `downgrade()`
- [ ] No sync I/O in async functions

## Before Commit

```bash
# Type check database code
mypy --strict app/models/ app/db/

# Test database operations
pytest tests/test_db.py -v

# Verify migrations
alembic current
alembic history
```
