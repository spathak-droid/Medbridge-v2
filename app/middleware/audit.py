"""HIPAA audit logging middleware.

Logs all access to PHI endpoints to both a file and the database.
Database entries include a hash chain for tamper detection.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Dedicated audit logger — file-based backup
audit_logger = logging.getLogger("hipaa.audit")

# PHI-related path prefixes that require audit logging
PHI_PATH_PREFIXES = (
    "/api/patients",
    "/api/coach",
    "/api/alerts",
    "/api/goals",
    "/api/messages",
    "/api/analytics",
)

# Paths explicitly excluded from audit logging
EXCLUDED_PATHS = ("/health", "/docs", "/openapi.json", "/redoc")

# In-memory last hash for chain continuity (seeded from DB on first write)
_last_hash = "genesis"
_hash_initialized = False


def setup_audit_logging():
    """Configure the audit logger to write structured JSON to a file."""
    audit_log_path = os.getenv("AUDIT_LOG_PATH", "audit.log")
    handler = logging.FileHandler(audit_log_path, mode="a")
    handler.setFormatter(logging.Formatter("%(message)s"))
    audit_logger.addHandler(handler)
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = False


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Middleware that logs all PHI access for HIPAA compliance."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip non-PHI paths
        if not any(path.startswith(prefix) for prefix in PHI_PATH_PREFIXES):
            return await call_next(request)

        if any(path.startswith(exc) for exc in EXCLUDED_PATHS):
            return await call_next(request)

        start_time = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000)

        # Extract user info from request state (set by auth dependency)
        user_uid = getattr(request.state, "user_uid", "anonymous")
        user_role = getattr(request.state, "user_role", "unknown")

        # Extract patient_id from path or POST body
        patient_id = _extract_patient_id(path)

        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "phi_access",
            "user_uid": user_uid,
            "user_role": user_role,
            "method": request.method,
            "path": path,
            "patient_id": patient_id,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": _get_client_ip(request),
        }

        # Write to file (always — backup)
        audit_logger.info(json.dumps(audit_entry))

        # Write to database with hash chain (best-effort, non-blocking)
        try:
            await _write_audit_to_db(audit_entry)
        except Exception:
            pass  # Never let audit logging break the request

        return response


async def _write_audit_to_db(entry: dict):
    """Write audit entry to database with hash chain for tamper detection."""
    global _last_hash, _hash_initialized

    from app.database import async_session_factory
    from app.models.audit_log import AuditLog

    async with async_session_factory() as session:
        # Initialize hash chain from DB on first write
        if not _hash_initialized:
            from sqlalchemy import select, desc
            result = await session.execute(
                select(AuditLog.entry_hash).order_by(desc(AuditLog.id)).limit(1)
            )
            last = result.scalar_one_or_none()
            if last:
                _last_hash = last
            _hash_initialized = True

        entry_hash = AuditLog.compute_hash(_last_hash, entry)

        log = AuditLog(
            timestamp=datetime.fromisoformat(entry["timestamp"]),
            event=entry["event"],
            user_uid=entry["user_uid"],
            user_role=entry["user_role"],
            method=entry["method"],
            path=entry["path"],
            patient_id=entry.get("patient_id"),
            status_code=entry["status_code"],
            duration_ms=entry["duration_ms"],
            client_ip=entry["client_ip"],
            entry_hash=entry_hash,
            previous_hash=_last_hash,
        )
        session.add(log)
        await session.commit()
        _last_hash = entry_hash


def _extract_patient_id(path: str) -> str | None:
    """Extract patient_id from URL path segments."""
    parts = path.split("/")
    for i, part in enumerate(parts):
        if part == "patients" and i + 1 < len(parts):
            candidate = parts[i + 1]
            if candidate.isdigit():
                return candidate
        # Also check /messages/patient/{id}
        if part == "patient" and i + 1 < len(parts):
            candidate = parts[i + 1]
            if candidate.isdigit():
                return candidate
    return None


def _get_client_ip(request: Request) -> str:
    """Get client IP, respecting X-Forwarded-For behind a proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
