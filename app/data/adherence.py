"""Adherence computation from exercise_logs and video_watch_logs.

Computes real adherence stats using a blended 50/50 score (exercise completion
+ video watch) for any patient with an assigned program. Falls back to
hardcoded demo data for seed patients.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.programs import PROGRAMS, get_program_for_patient
from app.models.exercise_log import ExerciseLog
from app.models.video_watch_log import VideoWatchLog


async def compute_adherence(
    session: AsyncSession,
    patient_id: int,
    external_id: str,
    program_type: str | None,
) -> dict | None:
    """Compute adherence stats from actual exercise_logs and video_watch_logs.

    Uses a blended 50/50 score: average of (completion% + video%) / 2.
    Returns None if no program is assigned.
    """
    program = get_program_for_patient(external_id, program_type)
    if not program:
        return None

    exercises = program["exercises"]
    exercise_ids = {ex["id"] for ex in exercises}
    duration_weeks = program["duration_weeks"]
    today = date.today()

    # Fetch all exercise completion logs for this patient in this program
    result = await session.execute(
        select(ExerciseLog.exercise_id, ExerciseLog.completed_date).where(
            ExerciseLog.patient_id == patient_id,
            ExerciseLog.exercise_id.in_(exercise_ids),
            ExerciseLog.completed_date <= today,
        )
    )
    completion_logs = result.all()

    # Fetch all video watch logs for this patient in this program
    result = await session.execute(
        select(
            VideoWatchLog.exercise_id,
            VideoWatchLog.watched_date,
            VideoWatchLog.watch_percentage,
        ).where(
            VideoWatchLog.patient_id == patient_id,
            VideoWatchLog.exercise_id.in_(exercise_ids),
            VideoWatchLog.watched_date <= today,
        )
    )
    video_logs = result.all()

    # Program start = earliest date from EITHER completion or video logs
    all_dates_from_logs: list[date] = []
    if completion_logs:
        all_dates_from_logs.extend(row[1] for row in completion_logs)
    if video_logs:
        all_dates_from_logs.extend(row[1] for row in video_logs)

    if all_dates_from_logs:
        program_start = min(all_dates_from_logs)
    else:
        program_start = today

    program_end = program_start + timedelta(weeks=duration_weeks)
    total_days = (min(today, program_end) - program_start).days + 1
    if total_days < 1:
        total_days = 1

    # Group completion logs by date
    days_completions: dict[date, set[str]] = {}
    per_exercise_counts: dict[str, int] = {eid: 0 for eid in exercise_ids}
    for exercise_id, completed_date in completion_logs:
        if completed_date not in days_completions:
            days_completions[completed_date] = set()
        days_completions[completed_date].add(exercise_id)
        if exercise_id in per_exercise_counts:
            per_exercise_counts[exercise_id] += 1

    # Group video logs by date — track max watch percentage per exercise per day
    days_video: dict[date, dict[str, float]] = {}
    for exercise_id, watched_date, watch_percentage in video_logs:
        if watched_date not in days_video:
            days_video[watched_date] = {}
        current = days_video[watched_date].get(exercise_id, 0)
        days_video[watched_date][exercise_id] = max(current, watch_percentage)

    # Per-exercise video watch count: days where watch_percentage >= 80
    per_exercise_video_count: dict[str, int] = {eid: 0 for eid in exercise_ids}
    for d_date, exercises_watched in days_video.items():
        for eid, pct in exercises_watched.items():
            if pct >= 80 and eid in per_exercise_video_count:
                per_exercise_video_count[eid] += 1

    # All engaged dates = union of completion days and video days
    all_engaged_dates = set(days_completions.keys()) | set(days_video.keys())

    # A "completed day" = at least one exercise done OR video watched that day
    days_completed = len(all_engaged_dates)
    days_missed = total_days - days_completed
    adherence_pct = round((days_completed / total_days) * 100, 1) if total_days > 0 else 0.0

    # Streak calculation using all engaged dates
    current_streak = 0
    longest_streak = 0
    streak = 0
    d = today
    # Current streak: count back from today
    while d >= program_start:
        if d in all_engaged_dates:
            current_streak += 1
            d -= timedelta(days=1)
        else:
            break

    # Longest streak: scan all days
    d = program_start
    while d <= today:
        if d in all_engaged_dates:
            streak += 1
            longest_streak = max(longest_streak, streak)
        else:
            streak = 0
        d += timedelta(days=1)

    # Last completed
    last_completed = None
    if all_engaged_dates:
        last_completed = max(all_engaged_dates).isoformat()

    # Weekly breakdown
    weekly_breakdown = []
    week_start = program_start
    week_num = 1
    while week_start <= min(today, program_end):
        week_end = min(week_start + timedelta(days=6), today, program_end)
        week_days = (week_end - week_start).days + 1
        week_completed = sum(
            1 for d_iter in (week_start + timedelta(days=i) for i in range(week_days))
            if d_iter in all_engaged_dates
        )
        weekly_breakdown.append({
            "week": week_num,
            "completed": week_completed,
            "total": week_days,
        })
        week_start = week_end + timedelta(days=1)
        week_num += 1

    # Per-exercise stats with blended score
    per_exercise = {}
    for eid in exercise_ids:
        completed = per_exercise_counts.get(eid, 0)
        video_watched = per_exercise_video_count.get(eid, 0)
        comp_pct = (completed / total_days) * 100 if total_days > 0 else 0.0
        vid_pct = (video_watched / total_days) * 100 if total_days > 0 else 0.0
        blended_pct = round((comp_pct + vid_pct) / 2, 1)
        per_exercise[eid] = {
            "completed": completed,
            "video_watched": video_watched,
            "total": total_days,
            "pct": blended_pct,
        }

    # Daily log (last 7 days)
    daily_log = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        if d < program_start:
            continue
        exercises_done = len(days_completions.get(d, set()))
        videos_watched = sum(
            1 for pct in days_video.get(d, {}).values() if pct >= 80
        )
        daily_log.append({
            "date": d.isoformat(),
            "completed": d in all_engaged_dates,
            "exercises_done": exercises_done,
            "videos_watched": videos_watched,
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
            "psk-1": {"completed": 20, "video_watched": 18, "total": 21, "pct": 90.5},
            "psk-2": {"completed": 18, "video_watched": 16, "total": 21, "pct": 81.0},
            "psk-3": {"completed": 17, "video_watched": 15, "total": 21, "pct": 76.2},
            "psk-4": {"completed": 21, "video_watched": 19, "total": 21, "pct": 95.2},
            "psk-5": {"completed": 15, "video_watched": 13, "total": 21, "pct": 66.7},
            "psk-6": {"completed": 16, "video_watched": 14, "total": 21, "pct": 71.4},
            "psk-7": {"completed": 18, "video_watched": 17, "total": 21, "pct": 83.3},
            "psk-8": {"completed": 14, "video_watched": 12, "total": 21, "pct": 61.9},
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
            "fp-1": {"completed": 1, "video_watched": 1, "total": 2, "pct": 50.0},
            "fp-2": {"completed": 1, "video_watched": 0, "total": 2, "pct": 25.0},
            "fp-3": {"completed": 0, "video_watched": 0, "total": 2, "pct": 0.0},
            "fp-4": {"completed": 1, "video_watched": 1, "total": 2, "pct": 50.0},
            "fp-5": {"completed": 1, "video_watched": 1, "total": 2, "pct": 50.0},
            "fp-6": {"completed": 0, "video_watched": 0, "total": 2, "pct": 0.0},
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
            "spr-1": {"completed": 12, "video_watched": 10, "total": 21, "pct": 52.4},
            "spr-2": {"completed": 10, "video_watched": 8, "total": 21, "pct": 42.9},
            "spr-3": {"completed": 8, "video_watched": 7, "total": 21, "pct": 35.7},
            "spr-4": {"completed": 14, "video_watched": 12, "total": 21, "pct": 61.9},
            "spr-5": {"completed": 9, "video_watched": 7, "total": 21, "pct": 38.1},
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
            "lbp-1": {"completed": 20, "video_watched": 18, "total": 30, "pct": 63.3},
            "lbp-2": {"completed": 15, "video_watched": 12, "total": 30, "pct": 45.0},
            "lbp-3": {"completed": 18, "video_watched": 15, "total": 30, "pct": 55.0},
            "lbp-4": {"completed": 20, "video_watched": 17, "total": 30, "pct": 61.7},
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
