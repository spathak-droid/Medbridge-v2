"""Coach tools for LangGraph — TICKET-006.

Five LangGraph-compatible tools for the coaching agent:
- set_goal: persists a goal to the Goal model
- set_reminder: creates a ScheduleEvent record
- get_program_summary: returns stubbed exercise program data
- get_adherence_summary: returns stubbed adherence stats
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
from app.data.programs import PROGRAMS, get_program_for_patient
from app.models.alert import Alert
from app.models.enums import AlertUrgency, EventType, ScheduleStatus
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent


import re as _re


def _extract_structured_goal(raw_text: str) -> dict:
    """Parse free-text goal into structured fields using pattern matching.

    Extracts activity, frequency, duration, and unit where possible.
    Falls back to storing the full text as the activity.
    """
    text = raw_text.lower().strip()

    # Try to extract duration (e.g. "10 minutes", "30 min", "1 hour")
    duration_match = _re.search(r"(\d+)\s*(minutes?|mins?|hours?|hrs?)", text)
    duration = int(duration_match.group(1)) if duration_match else None
    duration_unit = None
    if duration_match:
        unit = duration_match.group(2)
        duration_unit = "minutes" if unit.startswith("min") else "hours"

    # Try to extract frequency (e.g. "once a day", "3 times a week", "daily", "twice daily")
    freq_patterns = [
        (r"(\d+)\s*(?:times?|x)\s*(?:a|per)\s*(day|week|month)", None),
        (r"once\s+(?:a|per)\s*(day|week|month)", "1"),
        (r"twice\s+(?:a|per|)?\s*(day|week|month)", "2"),
        (r"\b(daily)\b", "1"),
        (r"\b(weekly)\b", "1"),
    ]
    frequency = None
    frequency_unit = None
    for pattern, default_count in freq_patterns:
        freq_match = _re.search(pattern, text)
        if freq_match:
            groups = freq_match.groups()
            if default_count:
                frequency = int(default_count)
                period = groups[0] if groups else "day"
            else:
                frequency = int(groups[0])
                period = groups[1]
            if period == "daily":
                frequency_unit = "day"
            elif period == "weekly":
                frequency_unit = "week"
            else:
                frequency_unit = period
            break

    # Extract activity (the main verb/noun phrase)
    # Remove frequency and duration parts to get the activity
    activity = raw_text.strip()

    return {
        "activity": activity,
        "duration": duration,
        "duration_unit": duration_unit,
        "frequency": frequency,
        "frequency_unit": frequency_unit,
    }


def make_coach_tools(session: AsyncSession, patient_id: int) -> list:
    """Create coach tools bound to the given DB session and patient.

    The patient_id is captured at creation time so the LLM doesn't need to
    provide internal DB IDs — it only supplies the domain-relevant arguments.

    Returns a list of 5 LangGraph-compatible BaseTool instances.
    """

    @tool
    async def set_goal(
        goal_text: str,
        instructions: str = "",
        precautions: str = "",
        video_url: str = "",
        video_title: str = "",
    ) -> str:
        """Set a health or rehabilitation goal for the patient.

        Use this when the patient agrees to or proposes an exercise goal.
        Always provide detailed instructions, precautions, and a relevant video link.

        Args:
            goal_text: The goal description (e.g. "Walk 20 minutes 3 times a week").
            instructions: Step-by-step instructions on HOW to achieve this goal safely.
                Include specific technique tips, warm-up recommendations, and progression advice.
                Use numbered steps. Example: "1. Start with a 5-min warm-up walk at easy pace..."
            precautions: Safety precautions and when to seek medical attention.
                Include warning signs to stop exercising. Example: "Stop immediately if you feel
                sharp pain, dizziness, or shortness of breath. Contact your care team if..."
            video_url: A relevant YouTube video URL demonstrating the exercise or technique.
                Use well-known physical therapy channels. Example: "https://www.youtube.com/watch?v=..."
            video_title: Title/description of the video. Example: "Proper Walking Form for Rehab - Bob & Brad"
        """
        structured = _extract_structured_goal(goal_text)
        structured["instructions"] = instructions
        structured["precautions"] = precautions
        if video_url:
            structured["video_url"] = video_url
            structured["video_title"] = video_title or "Exercise Guide Video"
        goal = Goal(
            patient_id=patient_id,
            raw_text=goal_text,
            structured_goal=structured,
        )
        session.add(goal)
        await session.commit()
        return f"Goal saved: {goal_text}"

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
            return json.dumps({"message": "No program assigned yet. Use assign_program to assign one."})

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

    @tool
    async def assign_program(program_type: str) -> str:
        """Assign an exercise program to the patient based on their needs.

        Available program types:
        - knee_rehab_post_surgical: Post-surgical knee rehabilitation (quad sets, leg raises, heel slides, wall squats, calf raises)
        - shoulder_rehab: Shoulder rehabilitation (pendulum swings, wall walks, external rotation, scapular squeezes)
        - lower_back_rehab: Lower back rehabilitation (cat-cow, bird-dog, pelvic tilts, bridges, dead bugs)
        - fall_prevention: Fall prevention & balance (tandem stance, heel-to-toe walk, single leg stand, sit-to-stand, step-ups)
        - general_mobility: General mobility & flexibility (neck stretches, seated spinal twist, shoulder rolls, hamstring stretch)

        Args:
            program_type: One of the available program type keys listed above.
        """
        if program_type not in PROGRAMS:
            available = ", ".join(PROGRAMS.keys())
            return json.dumps({"error": f"Unknown program type '{program_type}'. Available: {available}"})

        result = await session.execute(select(Patient).where(Patient.id == patient_id))
        patient = result.scalar_one_or_none()
        if patient is None:
            return json.dumps({"error": "Patient not found"})

        patient.program_type = program_type
        session.add(patient)
        await session.commit()

        program = PROGRAMS[program_type]
        exercise_names = [ex["name"] for ex in program["exercises"]]
        return json.dumps({
            "assigned": program_type,
            "program_name": program["program_name"],
            "exercises": exercise_names,
            "message": f"Assigned {program['program_name']} with {len(exercise_names)} exercises.",
        })

    return [set_goal, set_reminder, assign_program, get_program_summary, get_adherence_summary, alert_clinician]
