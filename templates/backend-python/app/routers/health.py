"""Health check endpoint."""

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.db.engine import engine

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str
    timestamp: str
    db: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    GET /api/v1/health → {"status":"ok","timestamp":"...","db":"ok"}

    Used by /setup to verify the API is running after scaffold.
    """
    db_status = "ok"
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    status = "ok" if db_status == "ok" else "degraded"

    return HealthResponse(
        status=status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        db=db_status,
    )
