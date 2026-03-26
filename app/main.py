"""FastAPI application factory."""

from dotenv import load_dotenv

load_dotenv()

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.coach import router as coach_router
from app.api.goals import router as goals_router
from app.api.health import router as health_router
from app.api.messaging import router as messaging_router
from app.api.patients import router as patients_router
from app.api.risk import router as risk_router
from app.middleware.audit import AuditLogMiddleware, setup_audit_logging
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Application lifespan — starts background scheduler."""
    from app.services.scheduler import run_scheduler

    setup_audit_logging()

    scheduler_task = asyncio.create_task(run_scheduler())
    logger.info("Background scheduler started")
    yield
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    logger.info("Background scheduler stopped")


# Allowed origins — restrict to known frontend origins
_allowed_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")


def create_app() -> FastAPI:
    application = FastAPI(
        title="MedBridge API", version="0.1.0", lifespan=lifespan,
    )

    # --- Middleware (order matters: outermost first) ---

    # Security headers on all responses
    application.add_middleware(SecurityHeadersMiddleware)

    # Rate limiting
    application.add_middleware(
        RateLimitMiddleware,
        requests_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "300")),
    )

    # HIPAA audit logging
    application.add_middleware(AuditLogMiddleware)

    # CORS — restricted to known origins
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in _allowed_origins],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    application.include_router(auth_router)
    application.include_router(health_router)
    application.include_router(risk_router)
    application.include_router(patients_router)
    application.include_router(coach_router)
    application.include_router(alerts_router)
    application.include_router(goals_router)
    application.include_router(analytics_router)
    application.include_router(messaging_router)

    return application


app = create_app()
