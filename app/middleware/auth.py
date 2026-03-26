"""Firebase token verification middleware and dependencies for HIPAA-compliant auth."""

import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session

logger = logging.getLogger(__name__)

_security = HTTPBearer(auto_error=False)

# Cache for Google's public keys
_google_certs: dict = {}
_google_certs_expiry: float = 0

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"


def _is_dev_mode() -> bool:
    """Check if running in development/demo mode (auth bypass allowed).

    IMPORTANT: Defaults to production (safe). Must explicitly set APP_ENV=development
    to enable demo auth bypass. Never enable in production deployments.
    """
    return os.getenv("APP_ENV", "production") == "development"


def _get_google_certs() -> dict:
    """Fetch and cache Google's public certificates for Firebase token verification."""
    global _google_certs, _google_certs_expiry

    if _google_certs and time.time() < _google_certs_expiry:
        return _google_certs

    resp = httpx.get(GOOGLE_CERTS_URL, timeout=10)
    resp.raise_for_status()
    _google_certs = resp.json()

    # Parse cache-control max-age
    cache_control = resp.headers.get("cache-control", "")
    max_age = 3600  # default 1 hour
    for part in cache_control.split(","):
        part = part.strip()
        if part.startswith("max-age="):
            try:
                max_age = int(part.split("=")[1])
            except ValueError:
                pass
    _google_certs_expiry = time.time() + max_age

    return _google_certs


def _verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token using Google's public keys.

    This doesn't require a service account — just the project ID and Google's
    public certificates (fetched over HTTPS).
    """
    import jwt  # PyJWT
    from cryptography.x509 import load_pem_x509_certificate

    # Decode header to get key ID
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("Token has no kid header")

    # Get the matching public key
    certs = _get_google_certs()
    cert_pem = certs.get(kid)
    if not cert_pem:
        # Refresh certs in case they rotated
        global _google_certs_expiry
        _google_certs_expiry = 0
        certs = _get_google_certs()
        cert_pem = certs.get(kid)
        if not cert_pem:
            raise ValueError(f"No matching certificate for kid: {kid}")

    # Extract public key from x509 certificate
    cert = load_pem_x509_certificate(cert_pem.encode())
    public_key = cert.public_key()

    # Verify and decode the token
    decoded = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=FIREBASE_PROJECT_ID,
        issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
    )

    return decoded


@dataclass
class AuthenticatedUser:
    """Represents a verified Firebase user."""
    uid: str
    email: Optional[str]
    role: str  # "patient" or "clinician"


def _parse_demo_token(token: str) -> AuthenticatedUser | None:
    """Parse X-Demo-User header for dev/demo mode only."""
    if not _is_dev_mode():
        return None
    parts = token.split(":")
    if len(parts) == 2 and parts[1] in ("patient", "clinician"):
        return AuthenticatedUser(uid=parts[0], email=None, role=parts[1])
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
    session: AsyncSession = Depends(get_session),
) -> AuthenticatedUser:
    """Verify Firebase ID token and return the authenticated user.

    Role resolution order:
    1. Firebase custom claims (if set via Admin SDK)
    2. Backend ``app_users`` table (populated at signup/signin)
    3. Default: "patient"
    """
    # Dev/demo mode: check X-Demo-User header (NEVER active in production)
    demo_header = request.headers.get("x-demo-user")
    if demo_header:
        if not _is_dev_mode():
            logger.warning("X-Demo-User header rejected — not in development mode")
        else:
            demo_user = _parse_demo_token(demo_header)
            if demo_user:
                return demo_user

    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    token = credentials.credentials

    # In dev mode without Firebase project ID, reject
    if _is_dev_mode() and not FIREBASE_PROJECT_ID:
        raise HTTPException(
            status_code=401,
            detail="Firebase not configured. Use X-Demo-User header in dev mode.",
        )

    if not FIREBASE_PROJECT_ID:
        raise HTTPException(status_code=500, detail="FIREBASE_PROJECT_ID not set")

    try:
        decoded = _verify_firebase_token(token)
    except Exception as exc:
        error_msg = str(exc)
        logger.warning("Firebase token verification failed: %s", error_msg)
        if "expired" in error_msg.lower():
            raise HTTPException(status_code=403, detail="Token expired — re-authenticate")
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    uid = decoded.get("user_id") or decoded.get("sub", "")
    email = decoded.get("email")

    # Role: prefer custom claims from token, then fall back to DB lookup
    role = decoded.get("role")
    if not role:
        from app.models.app_user import AppUser

        result = await session.execute(
            select(AppUser.role).where(AppUser.firebase_uid == uid)
        )
        db_role = result.scalar_one_or_none()
        role = db_role or "patient"

    return AuthenticatedUser(uid=uid, email=email, role=role)


async def require_clinician(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role != "clinician":
        raise HTTPException(status_code=403, detail="Clinician access required")
    return user


async def require_patient(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access required")
    return user
