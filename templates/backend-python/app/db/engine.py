"""
Database engine — async SQLAlchemy with asyncpg.

Uses DATABASE_URL from environment (same convention as NestJS/Prisma).
"""

import os
import sys

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    print("FATAL: DATABASE_URL environment variable is required", file=sys.stderr)
    sys.exit(1)


def _to_async_url(url: str) -> str:
    """Convert postgres:// to postgresql+asyncpg:// for SQLAlchemy async."""
    return url.replace("postgres://", "postgresql+asyncpg://", 1).replace(
        "postgresql://", "postgresql+asyncpg://", 1
    )


engine: AsyncEngine = create_async_engine(
    _to_async_url(DATABASE_URL),
    pool_size=10,
    pool_pre_ping=True,
)


async def check_db() -> None:
    """Verify database connectivity at startup."""
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
