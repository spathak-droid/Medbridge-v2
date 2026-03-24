"""Phase state machine service — TICKET-004.

Deterministic phase transitions for the patient coaching lifecycle:
PENDING → ONBOARDING → ACTIVE → RE_ENGAGING → DORMANT.

Transitions are controlled by application code, not LLM decisions.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PatientPhase
from app.models.goal import Goal
from app.models.patient import Patient


class TransitionError(Exception):
    """Raised when a phase transition is invalid or guard conditions are not met."""

    def __init__(
        self,
        patient_id: int,
        reason: str,
        *,
        from_phase: PatientPhase | None = None,
        to_phase: PatientPhase | None = None,
    ) -> None:
        self.patient_id = patient_id
        self.from_phase = from_phase
        self.to_phase = to_phase
        self.reason = reason
        super().__init__(reason)


# Valid transitions: {(from, to)}
VALID_TRANSITIONS: set[tuple[PatientPhase, PatientPhase]] = {
    (PatientPhase.PENDING, PatientPhase.ONBOARDING),
    (PatientPhase.ONBOARDING, PatientPhase.ACTIVE),
    (PatientPhase.ACTIVE, PatientPhase.DORMANT),
    (PatientPhase.DORMANT, PatientPhase.RE_ENGAGING),
    (PatientPhase.RE_ENGAGING, PatientPhase.ACTIVE),
}


class PhaseStateMachine:
    """Standalone service for deterministic patient phase transitions.

    Usage:
        machine = PhaseStateMachine(session)
        patient = await machine.transition(patient_id, PatientPhase.ONBOARDING)
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def transition(self, patient_id: int, target_phase: PatientPhase) -> Patient:
        """Transition a patient to the target phase.

        Validates the transition is allowed and guard conditions are met.
        Records a timestamp on the patient record.

        Raises TransitionError if the transition is invalid or guards fail.
        """
        result = await self._session.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = result.scalar_one_or_none()

        if patient is None:
            raise TransitionError(
                patient_id,
                f"Patient {patient_id} not found",
                to_phase=target_phase,
            )

        from_phase = patient.phase
        pair = (from_phase, target_phase)

        if pair not in VALID_TRANSITIONS:
            raise TransitionError(
                patient_id,
                f"Invalid transition: {from_phase.value} → {target_phase.value}",
                from_phase=from_phase,
                to_phase=target_phase,
            )

        # Check guard conditions for specific transitions
        await self._check_guards(patient, from_phase, target_phase)

        patient.phase = target_phase
        patient.phase_updated_at = datetime.now(timezone.utc)
        self._session.add(patient)
        await self._session.commit()
        await self._session.refresh(patient)
        return patient

    async def _check_guards(
        self,
        patient: Patient,
        from_phase: PatientPhase,
        target_phase: PatientPhase,
    ) -> None:
        """Check guard conditions for a specific transition."""
        if from_phase == PatientPhase.PENDING and target_phase == PatientPhase.ONBOARDING:
            if not patient.consent_given:
                raise TransitionError(
                    patient.id,
                    f"Patient {patient.id} has not given consent",
                    from_phase=from_phase,
                    to_phase=target_phase,
                )

        elif from_phase == PatientPhase.ONBOARDING and target_phase == PatientPhase.ACTIVE:
            result = await self._session.execute(
                select(Goal).where(
                    Goal.patient_id == patient.id,
                    Goal.confirmed == True,  # noqa: E712
                )
            )
            confirmed_goal = result.scalar_one_or_none()
            if confirmed_goal is None:
                raise TransitionError(
                    patient.id,
                    f"Patient {patient.id} has no confirmed goal",
                    from_phase=from_phase,
                    to_phase=target_phase,
                )

        elif from_phase == PatientPhase.ACTIVE and target_phase == PatientPhase.DORMANT:
            if patient.unanswered_count < 3:
                raise TransitionError(
                    patient.id,
                    f"Patient {patient.id} unanswered count is {patient.unanswered_count}, "
                    f"must be >= 3",
                    from_phase=from_phase,
                    to_phase=target_phase,
                )
