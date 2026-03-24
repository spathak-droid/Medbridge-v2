"""Firebase token verification middleware and dependencies for HIPAA-compliant auth."""

import logging
import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_firebase_initialized = False
_security = HTTPBearer(auto_error=False)


def _is_dev_mode() -> bool:
    """Check if running in development/demo mode (auth bypass allowed).

    IMPORTANT: Defaults to production (safe). Must explicitly set APP_ENV=development
    to enable demo auth bypass. Never enable in production deployments.
    """
    return os.getenv("APP_ENV", "production") == "development"


def _ensure_firebase():
    """Lazy-init Firebase Admin SDK."""
    global _firebase_initialized
    if _firebase_initialized:
        return
    import firebase_admin
    from firebase_admin import credentials

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")

    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    elif project_id:
        # Initialize with just project ID — can verify tokens using Google's public keys
        firebase_admin.initialize_app(options={"projectId": project_id})
        logger.info("Firebase initialized with project ID: %s", project_id)
    else:
        # In dev mode without credentials, skip Firebase init
        if _is_dev_mode():
            logger.warning("Firebase credentials not found — running in dev auth-bypass mode")
            return
        # Falls back to GOOGLE_APPLICATION_CREDENTIALS or default credentials
        firebase_admin.initialize_app()
    _firebase_initialized = True


@dataclass
class AuthenticatedUser:
    """Represents a verified Firebase user."""
    uid: str
    email: Optional[str]
    role: str  # "patient" or "clinician"


def _parse_demo_token(token: str) -> AuthenticatedUser | None:
    """Parse X-Demo-User header for dev/demo mode only.

    Format: "uid:role" e.g. "demo-patient:patient" or "demo-clinician:clinician"
    Only works when APP_ENV=development.
    """
    if not _is_dev_mode():
        return None
    parts = token.split(":")
    if len(parts) == 2 and parts[1] in ("patient", "clinician"):
        return AuthenticatedUser(uid=parts[0], email=None, role=parts[1])
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> AuthenticatedUser:
    """Verify Firebase ID token and return the authenticated user.

    In development mode, also accepts X-Demo-User header for demo login.
    Raises HTTP 401 if token is missing or invalid.
    Raises HTTP 403 if token is expired.
    """
    # Dev/demo mode: check X-Demo-User header (NEVER active in production)
    demo_header = request.headers.get("x-demo-user")
    if demo_header:
        if not _is_dev_mode():
            logger.warning("X-Demo-User header rejected — not in development mode")
        else:
            demo_user = _parse_demo_token(demo_header)
            if demo_user:
                logger.debug("Dev auth bypass for demo user: %s", demo_user.uid)
                return demo_user

    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    token = credentials.credentials

    # In dev mode without any Firebase config, reject — require X-Demo-User header
    has_firebase = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        or os.getenv("FIREBASE_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
    )
    if _is_dev_mode() and not has_firebase:
        raise HTTPException(
            status_code=401,
            detail="Firebase not configured. Use X-Demo-User header in dev mode.",
        )

    try:
        _ensure_firebase()
        from firebase_admin import auth

        decoded = auth.verify_id_token(token, check_revoked=False)
    except Exception as exc:
        error_msg = str(exc)
        logger.warning("Firebase token verification failed: %s", error_msg)
        if "expired" in error_msg.lower():
            raise HTTPException(status_code=403, detail="Token expired — re-authenticate")
        if "revoked" in error_msg.lower():
            raise HTTPException(status_code=401, detail="Token revoked — re-authenticate")
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {error_msg[:100]}")

    uid = decoded.get("uid", "")
    email = decoded.get("email")
    # Role from custom claims; default to "patient"
    role = decoded.get("role", "patient")

    return AuthenticatedUser(uid=uid, email=email, role=role)


async def require_clinician(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Dependency that restricts access to clinicians only."""
    if user.role != "clinician":
        raise HTTPException(status_code=403, detail="Clinician access required")
    return user


async def require_patient(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Dependency that restricts access to patients only."""
    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access required")
    return user
