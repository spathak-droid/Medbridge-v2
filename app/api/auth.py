"""Auth endpoints — register user role in backend DB."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import AuthenticatedUser, get_current_user
from app.models.app_user import AppUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    role: str  # "patient" or "clinician"


class RegisterResponse(BaseModel):
    uid: str
    role: str


@router.post("/register", response_model=RegisterResponse)
async def register_role(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(get_current_user),
) -> RegisterResponse:
    """Store the authenticated user's role in the backend DB.

    Called by the frontend after signup or signin so the backend knows
    whether this user is a patient or clinician (Firebase custom claims
    aren't available without a service account).
    """
    if body.role not in ("patient", "clinician"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="role must be 'patient' or 'clinician'")

    result = await session.execute(
        select(AppUser).where(AppUser.firebase_uid == user.uid)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.role = body.role
        session.add(existing)
    else:
        session.add(AppUser(firebase_uid=user.uid, role=body.role))

    await session.commit()

    return RegisterResponse(uid=user.uid, role=body.role)
