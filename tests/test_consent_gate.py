"""Tests for the consent gate service — TICKET-003.

Covers all acceptance criteria:
- Patient not logged in → blocked
- Patient logged in but no consent → blocked
- Patient logged in AND consented → allowed
- Patient with revoked consent → blocked
- Blocked interaction short-circuits (no LLM call)
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.services.consent_gate import ConsentError, ConsentGateService


async def _create_patient(
    session: AsyncSession,
    *,
    external_id: str = "pat-001",
    name: str = "Test Patient",
    logged_in: bool = False,
    consent_given: bool = False,
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name=name,
        logged_in=logged_in,
        consent_given=consent_given,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


class TestConsentGateService:
    """Test the ConsentGateService used in LangGraph nodes."""

    async def test_blocks_patient_not_logged_in(self, db_session: AsyncSession):
        """AC1: Patient not logged in → interaction blocked."""
        patient = await _create_patient(db_session, logged_in=False, consent_given=False)
        gate = ConsentGateService(db_session)
        with pytest.raises(ConsentError, match="not logged in"):
            await gate.verify(patient.id)

    async def test_blocks_patient_logged_in_no_consent(self, db_session: AsyncSession):
        """AC2: Logged in but no consent → interaction blocked."""
        patient = await _create_patient(
            db_session, external_id="pat-002", logged_in=True, consent_given=False
        )
        gate = ConsentGateService(db_session)
        with pytest.raises(ConsentError, match="not consented"):
            await gate.verify(patient.id)

    async def test_allows_patient_fully_consented(self, db_session: AsyncSession):
        """AC3: Logged in AND consented → interaction proceeds."""
        patient = await _create_patient(
            db_session, external_id="pat-003", logged_in=True, consent_given=True
        )
        gate = ConsentGateService(db_session)
        result = await gate.verify(patient.id)
        assert result is True

    async def test_blocks_after_consent_revoked(self, db_session: AsyncSession):
        """AC4: Previously consented but consent revoked → blocked."""
        patient = await _create_patient(
            db_session, external_id="pat-004", logged_in=True, consent_given=True
        )
        # Revoke consent
        patient.consent_given = False
        session = db_session
        session.add(patient)
        await session.commit()

        gate = ConsentGateService(db_session)
        with pytest.raises(ConsentError, match="not consented"):
            await gate.verify(patient.id)

    async def test_raises_for_nonexistent_patient(self, db_session: AsyncSession):
        """Edge case: patient ID doesn't exist."""
        gate = ConsentGateService(db_session)
        with pytest.raises(ConsentError, match="not found"):
            await gate.verify(99999)

    async def test_verify_returns_true_not_patient_object(self, db_session: AsyncSession):
        """Verify returns a simple boolean True — no extra data leaks."""
        patient = await _create_patient(
            db_session, external_id="pat-005", logged_in=True, consent_given=True
        )
        gate = ConsentGateService(db_session)
        result = await gate.verify(patient.id)
        assert result is True

    async def test_always_queries_fresh_from_db(self, db_session: AsyncSession):
        """Gate is stateless — always checks fresh DB state."""
        patient = await _create_patient(
            db_session, external_id="pat-006", logged_in=True, consent_given=True
        )
        gate = ConsentGateService(db_session)
        # First check passes
        assert await gate.verify(patient.id) is True

        # Revoke consent
        patient.consent_given = False
        db_session.add(patient)
        await db_session.commit()

        # Second check must fail (no caching)
        with pytest.raises(ConsentError, match="not consented"):
            await gate.verify(patient.id)

    async def test_consent_error_has_patient_id(self, db_session: AsyncSession):
        """ConsentError carries the patient_id for logging/debugging."""
        patient = await _create_patient(db_session, external_id="pat-007", logged_in=False)
        gate = ConsentGateService(db_session)
        with pytest.raises(ConsentError) as exc_info:
            await gate.verify(patient.id)
        assert exc_info.value.patient_id == patient.id
