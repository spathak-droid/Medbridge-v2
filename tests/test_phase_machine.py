"""Tests for TICKET-004: phase state machine with deterministic transitions.

Covers all acceptance criteria:
- PENDING → ONBOARDING when consent is verified
- ONBOARDING → ACTIVE when goal is confirmed and stored
- ACTIVE → DORMANT when unanswered_count reaches 3
- DORMANT → RE_ENGAGING when patient sends new message
- RE_ENGAGING → ACTIVE when re-engagement completes
- Invalid transition raises TransitionError and phase unchanged
- Any phase transition records a timestamp on the patient record
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PatientPhase
from app.models.goal import Goal
from app.models.patient import Patient
from app.services.phase_machine import PhaseStateMachine, TransitionError


async def _create_patient(
    session: AsyncSession,
    *,
    external_id: str = "pat-001",
    name: str = "Test Patient",
    phase: PatientPhase = PatientPhase.PENDING,
    consent_given: bool = False,
    logged_in: bool = False,
    unanswered_count: int = 0,
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name=name,
        phase=phase,
        consent_given=consent_given,
        logged_in=logged_in,
        unanswered_count=unanswered_count,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


class TestPendingToOnboarding:
    """AC1: PENDING → ONBOARDING when consent is verified."""

    async def test_transitions_when_consent_verified(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, consent_given=True, logged_in=True,
        )
        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.ONBOARDING)
        assert updated.phase == PatientPhase.ONBOARDING

    async def test_blocked_without_consent(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-002", consent_given=False,
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError, match="consent"):
            await machine.transition(patient.id, PatientPhase.ONBOARDING)
        await db_session.refresh(patient)
        assert patient.phase == PatientPhase.PENDING


class TestOnboardingToActive:
    """AC2: ONBOARDING → ACTIVE when goal is confirmed and stored."""

    async def test_transitions_when_goal_confirmed(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, phase=PatientPhase.ONBOARDING, consent_given=True,
        )
        goal = Goal(patient_id=patient.id, raw_text="Walk daily", confirmed=True, clinician_approved=True)
        db_session.add(goal)
        await db_session.commit()

        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.ACTIVE)
        assert updated.phase == PatientPhase.ACTIVE

    async def test_blocked_without_confirmed_goal(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-003", phase=PatientPhase.ONBOARDING,
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError, match="goal"):
            await machine.transition(patient.id, PatientPhase.ACTIVE)
        await db_session.refresh(patient)
        assert patient.phase == PatientPhase.ONBOARDING

    async def test_blocked_with_unconfirmed_goal(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-004", phase=PatientPhase.ONBOARDING,
        )
        goal = Goal(patient_id=patient.id, raw_text="Walk daily", confirmed=False)
        db_session.add(goal)
        await db_session.commit()

        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError, match="goal"):
            await machine.transition(patient.id, PatientPhase.ACTIVE)


class TestActiveToDormant:
    """AC3: ACTIVE → DORMANT when unanswered_count reaches 3."""

    async def test_transitions_when_unanswered_count_is_3(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, phase=PatientPhase.ACTIVE, unanswered_count=3,
        )
        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.DORMANT)
        assert updated.phase == PatientPhase.DORMANT

    async def test_transitions_when_unanswered_count_exceeds_3(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-005", phase=PatientPhase.ACTIVE, unanswered_count=5,
        )
        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.DORMANT)
        assert updated.phase == PatientPhase.DORMANT

    async def test_blocked_when_unanswered_count_below_3(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-006", phase=PatientPhase.ACTIVE, unanswered_count=2,
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError, match="unanswered"):
            await machine.transition(patient.id, PatientPhase.DORMANT)
        await db_session.refresh(patient)
        assert patient.phase == PatientPhase.ACTIVE


class TestDormantToReEngaging:
    """AC4: DORMANT → RE_ENGAGING when patient sends new message."""

    async def test_transitions_from_dormant(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, phase=PatientPhase.DORMANT,
        )
        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.RE_ENGAGING)
        assert updated.phase == PatientPhase.RE_ENGAGING


class TestReEngagingToActive:
    """AC5: RE_ENGAGING → ACTIVE when re-engagement completes."""

    async def test_transitions_from_re_engaging(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, phase=PatientPhase.RE_ENGAGING,
        )
        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.ACTIVE)
        assert updated.phase == PatientPhase.ACTIVE


class TestInvalidTransitions:
    """AC6: Invalid transitions raise TransitionError and phase unchanged."""

    @pytest.mark.parametrize(
        "from_phase,to_phase",
        [
            (PatientPhase.PENDING, PatientPhase.ACTIVE),
            (PatientPhase.PENDING, PatientPhase.DORMANT),
            (PatientPhase.PENDING, PatientPhase.RE_ENGAGING),
            (PatientPhase.ONBOARDING, PatientPhase.DORMANT),
            (PatientPhase.ONBOARDING, PatientPhase.PENDING),
            (PatientPhase.ONBOARDING, PatientPhase.RE_ENGAGING),
            (PatientPhase.ACTIVE, PatientPhase.PENDING),
            (PatientPhase.ACTIVE, PatientPhase.ONBOARDING),
            (PatientPhase.ACTIVE, PatientPhase.RE_ENGAGING),
            (PatientPhase.DORMANT, PatientPhase.PENDING),
            (PatientPhase.DORMANT, PatientPhase.ONBOARDING),
            (PatientPhase.DORMANT, PatientPhase.ACTIVE),
            (PatientPhase.RE_ENGAGING, PatientPhase.PENDING),
            (PatientPhase.RE_ENGAGING, PatientPhase.ONBOARDING),
            (PatientPhase.RE_ENGAGING, PatientPhase.DORMANT),
        ],
    )
    async def test_invalid_transition_raises_error(
        self, db_session: AsyncSession, from_phase: PatientPhase, to_phase: PatientPhase,
    ):
        patient = await _create_patient(
            db_session,
            external_id=f"pat-inv-{from_phase.value}-{to_phase.value}",
            phase=from_phase,
            consent_given=True,
            unanswered_count=5,
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError):
            await machine.transition(patient.id, to_phase)
        await db_session.refresh(patient)
        assert patient.phase == from_phase

    async def test_same_phase_transition_raises_error(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-same", phase=PatientPhase.ACTIVE,
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError):
            await machine.transition(patient.id, PatientPhase.ACTIVE)


class TestTimestampRecording:
    """AC7: Any phase transition records a timestamp on the patient record."""

    async def test_phase_updated_at_set_on_transition(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, consent_given=True, logged_in=True,
        )
        assert patient.phase_updated_at is None

        machine = PhaseStateMachine(db_session)
        updated = await machine.transition(patient.id, PatientPhase.ONBOARDING)
        assert updated.phase_updated_at is not None

    async def test_phase_updated_at_changes_on_each_transition(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-ts2", consent_given=True, logged_in=True,
        )
        machine = PhaseStateMachine(db_session)

        updated = await machine.transition(patient.id, PatientPhase.ONBOARDING)
        first_ts = updated.phase_updated_at

        # Add confirmed + clinician-approved goal so ONBOARDING → ACTIVE is valid
        goal = Goal(patient_id=patient.id, raw_text="Walk daily", confirmed=True, clinician_approved=True)
        db_session.add(goal)
        await db_session.commit()

        updated = await machine.transition(patient.id, PatientPhase.ACTIVE)
        second_ts = updated.phase_updated_at
        assert second_ts is not None
        assert second_ts >= first_ts


class TestEdgeCases:
    """Edge cases for the phase state machine."""

    async def test_nonexistent_patient_raises(self, db_session: AsyncSession):
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError, match="not found"):
            await machine.transition(99999, PatientPhase.ONBOARDING)

    async def test_transition_error_has_patient_id(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-err",
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError) as exc_info:
            await machine.transition(patient.id, PatientPhase.ACTIVE)
        assert exc_info.value.patient_id == patient.id

    async def test_transition_error_has_phases(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="pat-err2",
        )
        machine = PhaseStateMachine(db_session)
        with pytest.raises(TransitionError) as exc_info:
            await machine.transition(patient.id, PatientPhase.ACTIVE)
        assert exc_info.value.from_phase == PatientPhase.PENDING
        assert exc_info.value.to_phase == PatientPhase.ACTIVE
