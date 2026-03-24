"""Consent gate service — TICKET-003.

Verifies a patient has both logged into MedBridge Go and consented to outreach
before any coach interaction. Stateless: always checks fresh from DB.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient


class ConsentError(Exception):
    """Raised when a patient has not met consent requirements."""

    def __init__(self, patient_id: int, reason: str) -> None:
        self.patient_id = patient_id
        self.reason = reason
        super().__init__(reason)


class ConsentGateService:
    """Reusable consent gate for LangGraph nodes and service-layer calls.

    Usage:
        gate = ConsentGateService(session)
        await gate.verify(patient_id)  # raises ConsentError if not allowed
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def verify(self, patient_id: int) -> bool:
        """Check that the patient has logged in and consented.

        Returns True if allowed. Raises ConsentError otherwise.
        """
        result = await self._session.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = result.scalar_one_or_none()

        if patient is None:
            raise ConsentError(patient_id, f"Patient {patient_id} not found")

        if not patient.logged_in:
            raise ConsentError(patient_id, f"Patient {patient_id} has not logged in")

        if not patient.consent_given:
            raise ConsentError(patient_id, f"Patient {patient_id} has not consented to outreach")

        return True
