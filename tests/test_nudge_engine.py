"""Tests for behavioral science nudge engine.

Covers:
- Selection: each nudge type triggered by correct inputs
- Default fallback
- Prompts contain expected variables
- Edge cases
"""

import pytest

from app.services.nudge_engine import (
    NudgeType,
    build_nudge_prompt,
    select_nudge_type,
)


# ---------------------------------------------------------------------------
# Selection tests
# ---------------------------------------------------------------------------


class TestSelectNudgeType:
    def test_competence_feedback_high_adherence_and_streak(self):
        result = select_nudge_type(
            streak=5, adherence_pct=85.0, trend="HIGH", phase="ACTIVE"
        )
        assert result == NudgeType.COMPETENCE_FEEDBACK

    def test_competence_feedback_requires_streak_3(self):
        result = select_nudge_type(
            streak=2, adherence_pct=90.0, trend="HIGH", phase="ACTIVE"
        )
        assert result != NudgeType.COMPETENCE_FEEDBACK

    def test_loss_aversion_streak_and_moderate_adherence(self):
        result = select_nudge_type(
            streak=7, adherence_pct=70.0, trend="MODERATE", phase="ACTIVE"
        )
        assert result == NudgeType.LOSS_AVERSION

    def test_loss_aversion_not_triggered_below_60(self):
        result = select_nudge_type(
            streak=7, adherence_pct=55.0, trend="MODERATE", phase="ACTIVE"
        )
        assert result != NudgeType.LOSS_AVERSION

    def test_social_proof_low_adherence(self):
        result = select_nudge_type(
            streak=0, adherence_pct=30.0, trend="NEW", phase="ACTIVE"
        )
        assert result == NudgeType.SOCIAL_PROOF

    def test_social_proof_declining_trend(self):
        result = select_nudge_type(
            streak=2, adherence_pct=55.0, trend="DECLINING", phase="ACTIVE"
        )
        assert result == NudgeType.SOCIAL_PROOF

    def test_autonomy_support_onboarding(self):
        result = select_nudge_type(
            streak=0, adherence_pct=50.0, trend="MODERATE", phase="ONBOARDING"
        )
        assert result == NudgeType.AUTONOMY_SUPPORT

    def test_autonomy_support_re_engaging(self):
        result = select_nudge_type(
            streak=1, adherence_pct=50.0, trend="MODERATE", phase="RE_ENGAGING"
        )
        assert result == NudgeType.AUTONOMY_SUPPORT

    def test_autonomy_support_new_trend(self):
        result = select_nudge_type(
            streak=0, adherence_pct=50.0, trend="NEW", phase="ACTIVE"
        )
        assert result == NudgeType.AUTONOMY_SUPPORT

    def test_default_progress_anchoring(self):
        result = select_nudge_type(
            streak=2, adherence_pct=60.0, trend="MODERATE", phase="ACTIVE"
        )
        assert result == NudgeType.PROGRESS_ANCHORING

    def test_all_defaults_returns_valid_type(self):
        result = select_nudge_type()
        assert isinstance(result, NudgeType)

    def test_none_adherence_uses_default(self):
        result = select_nudge_type(adherence_pct=None, phase="ACTIVE")
        assert isinstance(result, NudgeType)


# ---------------------------------------------------------------------------
# Prompt building tests
# ---------------------------------------------------------------------------


class TestBuildNudgePrompt:
    def test_loss_aversion_contains_streak(self):
        prompt = build_nudge_prompt(
            NudgeType.LOSS_AVERSION, goal="Walk daily", streak=5, adherence_pct=70.0
        )
        assert "5" in prompt
        assert "Walk daily" in prompt

    def test_social_proof_contains_goal(self):
        prompt = build_nudge_prompt(
            NudgeType.SOCIAL_PROOF, goal="Stretch every morning", adherence_pct=25.0
        )
        assert "Stretch every morning" in prompt

    def test_competence_feedback_contains_exercises(self):
        prompt = build_nudge_prompt(
            NudgeType.COMPETENCE_FEEDBACK,
            goal="Full recovery",
            streak=7,
            adherence_pct=90.0,
            exercises_mastered=4,
            total_exercises=6,
        )
        assert "4" in prompt
        assert "6" in prompt

    def test_autonomy_support_contains_goal(self):
        prompt = build_nudge_prompt(
            NudgeType.AUTONOMY_SUPPORT, goal="Regain mobility"
        )
        assert "Regain mobility" in prompt

    def test_progress_anchoring_contains_adherence(self):
        prompt = build_nudge_prompt(
            NudgeType.PROGRESS_ANCHORING, goal="My goal", adherence_pct=65.0
        )
        assert "65" in prompt
