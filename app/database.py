import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Use PostgreSQL via DATABASE_URL env var; fallback to SQLite for local dev
_raw_url = os.getenv("DATABASE_URL", "")


def get_async_url() -> str:
    if _raw_url:
        return _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return "sqlite+aiosqlite:///./medbridge.db"


def get_sync_url() -> str:
    """Sync URL for alembic migrations (uses psycopg2, not asyncpg)."""
    if _raw_url:
        url = _raw_url
        if "asyncpg" in url:
            url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
        return url
    return "sqlite:///./medbridge.db"


class Base(DeclarativeBase):
    pass


# Lazy engine — not created at import time so alembic doesn't trigger asyncpg import
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_async_url(), echo=False)
    return _engine


def _get_session_factory():
    return async_sessionmaker(_get_engine(), class_=AsyncSession, expire_on_commit=False)


# Backward-compat: modules that import async_session_factory directly
# This is evaluated lazily — engine is only created when first called
class _LazySessionFactory:
    """Lazy wrapper so importing this module doesn't create the engine."""
    def __call__(self):
        return _get_session_factory()()

async_session_factory = _LazySessionFactory()


async def get_session() -> AsyncSession:  # type: ignore[misc]
    factory = _get_session_factory()
    async with factory() as session:
        yield session
