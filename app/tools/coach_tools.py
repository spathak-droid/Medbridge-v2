"""Coach tools for LangGraph — TICKET-006.

LangGraph-compatible tools for the coaching agent:
- set_reminder: creates a ScheduleEvent record
- get_program_summary: returns exercise program data
- get_adherence_summary: returns adherence stats
- alert_clinician: persists an alert to the Alert model

Uses a factory function (make_coach_tools) for DB session dependency injection.
"""

import json
from datetime import datetime
from typing import Optional

from langchain_core.tools import tool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.adherence import get_adherence_for_patient
from app.data.programs import get_program_for_patient
from app.models.alert import Alert
from app.models.enums import AlertUrgency, EventType, ScheduleStatus
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent


def make_coach_tools(session: AsyncSession, patient_id: int) -> list:
    """Create coach tools bound to the given DB session and patient.

    The patient_id is captured at creation time so the LLM doesn't need to
    provide internal DB IDs — it only supplies the domain-relevant arguments.

    Returns a list of LangGraph-compatible BaseTool instances.
    """

    @tool
    async def set_reminder(message: str, scheduled_time: str) -> str:
        """Schedule a reminder for the patient at a specific time.

        Args:
            message: The reminder text to send.
            scheduled_time: When to send it, as an ISO 8601 datetime string. Must be in the FUTURE.
        """
        from datetime import timezone as tz
        parsed_time = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
        now = datetime.now(tz.utc)
        # Ensure the reminder is in the future
        if parsed_time.tzinfo is None:
            parsed_time = parsed_time.replace(tzinfo=tz.utc)
        if parsed_time < now:
            return f"Error: scheduled_time {scheduled_time} is in the past. Today is {now.date().isoformat()}. Please provide a future date."
        event = ScheduleEvent(
            patient_id=patient_id,
            event_type=EventType.REMINDER,
            scheduled_at=parsed_time,
            message=message,
            status=ScheduleStatus.PENDING,
        )
        session.add(event)
        await session.commit()
        return f"Reminder scheduled at {parsed_time.isoformat()}: {message}"

    @tool
    async def get_program_summary() -> str:
        """Get a summary of the patient's assigned exercise program.

        Returns exercises with sets, reps, and frequency.
        """
        result = await session.execute(select(Patient).where(Patient.id == patient_id))
        patient = result.scalar_one_or_none()
        if patient is None:
            return json.dumps({"error": "Patient not found"})

        program = get_program_for_patient(patient.external_id, patient.program_type)
        if program is None:
            return json.dumps({"message": "No program assigned yet. The clinician needs to assign one."})

        return json.dumps(program, indent=2)

    @tool
    async def get_adherence_summary() -> str:
        """Get the patient's exercise adherence statistics.

        Returns days completed, current streak, and overall adherence percentage.
        """
        result = await session.execute(select(Patient).where(Patient.id == patient_id))
        patient = result.scalar_one_or_none()
        if patient is None:
            return json.dumps({"error": "Patient not found"})

        adherence = get_adherence_for_patient(patient.external_id, patient.program_type)
        if adherence is None:
            return json.dumps({"status": "PENDING", "message": "Patient has not started their program yet."})

        return json.dumps(adherence, indent=2)

    @tool
    async def alert_clinician(reason: str, urgency: Optional[str] = "NORMAL") -> str:
        """Alert the assigned clinician about a patient concern.

        Args:
            reason: Why the clinician is being alerted.
            urgency: CRITICAL, HIGH, or NORMAL (default).
        """
        urgency_enum = AlertUrgency(urgency)
        alert = Alert(
            patient_id=patient_id,
            reason=reason,
            urgency=urgency_enum,
        )
        session.add(alert)
        await session.commit()
        return f"Clinician alerted (urgency={urgency}): {reason}"

    return [set_reminder, get_program_summary, get_adherence_summary, alert_clinician]
