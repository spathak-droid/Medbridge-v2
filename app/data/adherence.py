"""Adherence computation from exercise_logs.

Computes real adherence stats from the exercise_logs table for any patient
with an assigned program. Falls back to hardcoded demo data for seed patients.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.programs import PROGRAMS, get_program_for_patient
from app.models.exercise_log import ExerciseLog


async def compute_adherence(
    session: AsyncSession,
    patient_id: int,
    external_id: str,
    program_type: str | None,
) -> dict | None:
    """Compute adherence stats from actual exercise_logs in the database.

    Returns None if no program is assigned.
    """
    program = get_program_for_patient(external_id, program_type)
    if not program:
        return None

    exercises = program["exercises"]
    exercise_ids = {ex["id"] for ex in exercises}
    duration_weeks = program["duration_weeks"]
    today = date.today()

    # Fetch all exercise logs for this patient in this program
    result = await session.execute(
        select(ExerciseLog.exercise_id, ExerciseLog.completed_date).where(
            ExerciseLog.patient_id == patient_id,
            ExerciseLog.exercise_id.in_(exercise_ids),
            ExerciseLog.completed_date <= today,
        )
    )
    logs = result.all()

    # Program start = date of first exercise log, or today if no logs yet.
    # This means adherence is measured from when the patient actually started.
    if logs:
        first_log_date = min(row[1] for row in logs)
        program_start = first_log_date
    else:
        program_start = today

    program_end = program_start + timedelta(weeks=duration_weeks)
    total_days = (min(today, program_end) - program_start).days + 1
    if total_days < 1:
        total_days = 1

    # Group by date
    days_with_completions: dict[date, set[str]] = {}
    per_exercise_counts: dict[str, int] = {eid: 0 for eid in exercise_ids}
    for exercise_id, completed_date in logs:
        if completed_date not in days_with_completions:
            days_with_completions[completed_date] = set()
        days_with_completions[completed_date].add(exercise_id)
        if exercise_id in per_exercise_counts:
            per_exercise_counts[exercise_id] += 1

    # A "completed day" = at least one exercise done that day
    days_completed = len(days_with_completions)
    days_missed = total_days - days_completed
    adherence_pct = round((days_completed / total_days) * 100, 1) if total_days > 0 else 0.0

    # Streak calculation
    current_streak = 0
    longest_streak = 0
    streak = 0
    d = today
    # Current streak: count back from today
    while d >= program_start:
        if d in days_with_completions:
            current_streak += 1
            d -= timedelta(days=1)
        else:
            break

    # Longest streak: scan all days
    d = program_start
    while d <= today:
        if d in days_with_completions:
            streak += 1
            longest_streak = max(longest_streak, streak)
        else:
            streak = 0
        d += timedelta(days=1)

    # Last completed
    last_completed = None
    if days_with_completions:
        last_completed = max(days_with_completions.keys()).isoformat()

    # Weekly breakdown
    weekly_breakdown = []
    week_start = program_start
    week_num = 1
    while week_start <= min(today, program_end):
        week_end = min(week_start + timedelta(days=6), today, program_end)
        week_days = (week_end - week_start).days + 1
        week_completed = sum(
            1 for d_iter in (week_start + timedelta(days=i) for i in range(week_days))
            if d_iter in days_with_completions
        )
        weekly_breakdown.append({
            "week": week_num,
            "completed": week_completed,
            "total": week_days,
        })
        week_start = week_end + timedelta(days=1)
        week_num += 1

    # Per-exercise stats
    per_exercise = {}
    for eid in exercise_ids:
        completed = per_exercise_counts.get(eid, 0)
        pct = round((completed / total_days) * 100, 1) if total_days > 0 else 0.0
        per_exercise[eid] = {"completed": completed, "total": total_days, "pct": pct}

    # Daily log (last 7 days)
    daily_log = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        if d < program_start:
            continue
        exercises_done = len(days_with_completions.get(d, set()))
        daily_log.append({
            "date": d.isoformat(),
            "completed": exercises_done > 0,
            "exercises_done": exercises_done,
        })

    # Status
    if days_completed == 0:
        status = "NEW"
    elif adherence_pct >= 75:
        status = "HIGH"
    elif adherence_pct >= 50:
        status = "MODERATE"
    elif current_streak == 0 and days_completed > 0:
        status = "DECLINING"
    else:
        status = "LOW"

    return {
        "status": status,
        "total_days_in_program": total_days,
        "days_completed": days_completed,
        "days_missed": days_missed,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "adherence_percentage": adherence_pct,
        "last_completed": last_completed,
        "weekly_breakdown": weekly_breakdown,
        "per_exercise": per_exercise,
        "daily_log": daily_log,
    }


# ---------------------------------------------------------------------------
# Sync wrapper for backward compatibility (demo patients)
# ---------------------------------------------------------------------------

ADHERENCE_DATA: dict[str, dict | None] = {
    "PT-SARAH-001": {
        "status": "HIGH",
        "total_days_in_program": 21,
        "days_completed": 18,
        "days_missed": 3,
        "current_streak": 7,
        "longest_streak": 10,
        "adherence_percentage": 85.7,
        "last_completed": "2026-03-23",
        "weekly_breakdown": [
            {"week": 1, "completed": 6, "total": 7},
            {"week": 2, "completed": 6, "total": 7},
            {"week": 3, "completed": 6, "total": 7},
        ],
        "per_exercise": {
            "kr-1": {"completed": 20, "total": 21, "pct": 95.2},
            "kr-2": {"completed": 18, "total": 21, "pct": 85.7},
            "kr-3": {"completed": 17, "total": 21, "pct": 81.0},
            "kr-4": {"completed": 21, "total": 21, "pct": 100.0},
            "kr-5": {"completed": 15, "total": 21, "pct": 71.4},
            "kr-6": {"completed": 16, "total": 21, "pct": 76.2},
        },
        "daily_log": [],
    },
    "PT-MARCUS-002": {
        "status": "NEW",
        "total_days_in_program": 2,
        "days_completed": 1,
        "days_missed": 1,
        "current_streak": 0,
        "longest_streak": 1,
        "adherence_percentage": 50.0,
        "last_completed": "2026-03-22",
        "weekly_breakdown": [{"week": 1, "completed": 1, "total": 2}],
        "per_exercise": {
            "fp-1": {"completed": 1, "total": 2, "pct": 50.0},
            "fp-2": {"completed": 1, "total": 2, "pct": 50.0},
            "fp-3": {"completed": 0, "total": 2, "pct": 0.0},
            "fp-4": {"completed": 1, "total": 2, "pct": 50.0},
            "fp-5": {"completed": 1, "total": 2, "pct": 50.0},
        },
        "daily_log": [],
    },
    "PT-EMILY-003": {
        "status": "DECLINING",
        "total_days_in_program": 21,
        "days_completed": 11,
        "days_missed": 10,
        "current_streak": 0,
        "longest_streak": 5,
        "adherence_percentage": 52.4,
        "last_completed": "2026-03-07",
        "weekly_breakdown": [],
        "per_exercise": {
            "sr-1": {"completed": 12, "total": 21, "pct": 57.1},
            "sr-2": {"completed": 10, "total": 21, "pct": 47.6},
            "sr-3": {"completed": 8, "total": 21, "pct": 38.1},
            "sr-4": {"completed": 14, "total": 21, "pct": 66.7},
            "sr-5": {"completed": 9, "total": 21, "pct": 42.9},
        },
        "daily_log": [],
    },
    "PT-JAMES-004": None,
    "PT-AISHA-005": {
        "status": "MODERATE",
        "total_days_in_program": 30,
        "days_completed": 18,
        "days_missed": 12,
        "current_streak": 2,
        "longest_streak": 6,
        "adherence_percentage": 60.0,
        "last_completed": "2026-03-23",
        "weekly_breakdown": [],
        "per_exercise": {
            "lb-1": {"completed": 20, "total": 30, "pct": 66.7},
            "lb-2": {"completed": 15, "total": 30, "pct": 50.0},
            "lb-3": {"completed": 18, "total": 30, "pct": 60.0},
            "lb-4": {"completed": 20, "total": 30, "pct": 66.7},
            "lb-5": {"completed": 12, "total": 30, "pct": 40.0},
        },
        "daily_log": [],
    },
}


def get_adherence_for_patient(external_id: str, program_type: str | None = None) -> dict | None:
    """Sync adherence lookup — only for demo patients with hardcoded data.

    For real patients, use compute_adherence() with a DB session instead.
    """
    data = ADHERENCE_DATA.get(external_id)
    if data is not None:
        return data
    if program_type:
        return {
            "status": "NEW",
            "total_days_in_program": 0,
            "days_completed": 0,
            "days_missed": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "adherence_percentage": 0.0,
            "last_completed": None,
            "weekly_breakdown": [],
            "per_exercise": {},
            "daily_log": [],
        }
    return None
