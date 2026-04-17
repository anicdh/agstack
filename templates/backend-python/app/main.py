"""
FastAPI application entry point.

Run: uvicorn app.main:app --reload --port 3000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.engine import engine, check_db
from app.routers import health


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: verify DB connection. Shutdown: dispose engine."""
    await check_db()
    yield
    await engine.dispose()


app = FastAPI(
    title="__PROJECT_NAME__",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")

# TODO: Add your routers here.
# app.include_router(users.router, prefix="/api/v1")
