"""Behavioral science nudge engine — COM-B model.

Selects and builds nudge prompts based on patient behavioral signals.
Uses evidence-based frameworks: loss aversion, social proof,
progress anchoring, autonomy support, competence feedback.
"""

from __future__ import annotations

import enum


class NudgeType(str, enum.Enum):
    LOSS_AVERSION = "LOSS_AVERSION"
    SOCIAL_PROOF = "SOCIAL_PROOF"
    PROGRESS_ANCHORING = "PROGRESS_ANCHORING"
    AUTONOMY_SUPPORT = "AUTONOMY_SUPPORT"
    COMPETENCE_FEEDBACK = "COMPETENCE_FEEDBACK"


# ---------------------------------------------------------------------------
# Nudge prompt templates
# ---------------------------------------------------------------------------

NUDGE_TEMPLATES: dict[NudgeType, str] = {
    NudgeType.LOSS_AVERSION: (
        "The patient has a {streak}-day exercise streak and {adherence_pct:.0f}% adherence. "
        "Use loss aversion framing — emphasize what they'll lose by stopping. "
        "Write a short, motivating check-in referencing their goal: '{goal}'. "
        "Example tone: \"Don't break your {streak}-day streak! You've worked hard to get here.\""
    ),
    NudgeType.SOCIAL_PROOF: (
        "The patient's adherence is low ({adherence_pct:.0f}%). "
        "Use social proof to normalize exercise and create positive peer pressure. "
        "Write a short, supportive message referencing their goal: '{goal}'. "
        "Example tone: \"87% of patients with your program did their exercises today — you can too!\""
    ),
    NudgeType.PROGRESS_ANCHORING: (
        "The patient has moderate adherence ({adherence_pct:.0f}%). "
        "Use progress anchoring to make their progress visible and motivating. "
        "Write a short message referencing their goal: '{goal}'. "
        "Highlight how far they've come. "
        "Example tone: \"You're {adherence_pct:.0f}% closer to your goal — keep going!\""
    ),
    NudgeType.AUTONOMY_SUPPORT: (
        "The patient is in an early or re-engaging phase. "
        "Use autonomy support — give them choices and control. "
        "Write a short, empowering message referencing their goal: '{goal}'. "
        "Example tone: \"Morning or evening — which time works best for your exercises?\""
    ),
    NudgeType.COMPETENCE_FEEDBACK: (
        "The patient has excellent adherence ({adherence_pct:.0f}%) and a {streak}-day streak. "
        "Use competence feedback — celebrate mastery and progress. "
        "Write a short, celebratory message referencing their goal: '{goal}'. "
        "They've completed {exercises_mastered} of {total_exercises} exercises. "
        "Example tone: \"You've mastered {exercises_mastered}/{total_exercises} exercises — incredible progress!\""
    ),
}


# ---------------------------------------------------------------------------
# Pure selection function
# ---------------------------------------------------------------------------


def select_nudge_type(
    *,
    streak: int = 0,
    adherence_pct: float | None = None,
    trend: str | None = None,
    phase: str | None = None,
    exercises_mastered: int = 0,
    total_exercises: int = 0,
) -> NudgeType:
    """Select the most appropriate nudge type based on patient signals.

    Pure function — no side effects or DB access.

    Priority order:
    1. COMPETENCE_FEEDBACK: high adherence + streak ≥ 3
    2. LOSS_AVERSION: streak ≥ 5 + moderate adherence (60-79%)
    3. SOCIAL_PROOF: low adherence or declining trend
    4. AUTONOMY_SUPPORT: onboarding/re-engaging or NEW trend
    5. PROGRESS_ANCHORING: default
    """
    pct = adherence_pct if adherence_pct is not None else 0.0
    trend_upper = (trend or "").upper()
    phase_upper = (phase or "").upper()

    # 1. Competence feedback for high performers
    if pct >= 80 and streak >= 3:
        return NudgeType.COMPETENCE_FEEDBACK

    # 2. Loss aversion for patients at risk of breaking a good streak
    if streak >= 5 and 60 <= pct < 80:
        return NudgeType.LOSS_AVERSION

    # 3. Social proof for struggling patients
    if pct < 40 or trend_upper == "DECLINING":
        return NudgeType.SOCIAL_PROOF

    # 4. Autonomy support for new/returning patients
    if phase_upper in ("ONBOARDING", "RE_ENGAGING") or trend_upper == "NEW":
        return NudgeType.AUTONOMY_SUPPORT

    # 5. Default: progress anchoring
    return NudgeType.PROGRESS_ANCHORING


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------


def build_nudge_prompt(
    nudge_type: NudgeType,
    *,
    goal: str = "your rehabilitation exercises",
    streak: int = 0,
    adherence_pct: float = 0.0,
    exercises_mastered: int = 0,
    total_exercises: int = 0,
) -> str:
    """Build a nudge prompt from the template with patient data filled in."""
    template = NUDGE_TEMPLATES[nudge_type]
    return template.format(
        goal=goal,
        streak=streak,
        adherence_pct=adherence_pct,
        exercises_mastered=exercises_mastered,
        total_exercises=total_exercises,
    )
