"""Tests for MI-enhanced system prompts.

Verifies that MI guidelines are properly integrated into all phase prompts
and contain all required OARS components.
"""

import pytest

from app.graphs.mi_guidelines import (
    ACTIVE_MI_TIPS,
    MI_OARS_GUIDELINES,
    ONBOARDING_MI_TIPS,
    RE_ENGAGING_MI_TIPS,
)


# ---------------------------------------------------------------------------
# MI Guidelines constant tests
# ---------------------------------------------------------------------------


class TestMIGuidelinesConstant:
    def test_guidelines_non_empty(self):
        assert len(MI_OARS_GUIDELINES) > 100

    def test_contains_open_questions(self):
        assert "Open Questions" in MI_OARS_GUIDELINES

    def test_contains_affirmations(self):
        assert "Affirmations" in MI_OARS_GUIDELINES

    def test_contains_reflections(self):
        assert "Reflections" in MI_OARS_GUIDELINES

    def test_contains_summaries(self):
        assert "Summaries" in MI_OARS_GUIDELINES

    def test_contains_change_talk(self):
        assert "Change Talk" in MI_OARS_GUIDELINES

    def test_contains_resistance_rolling(self):
        assert "Resistance Rolling" in MI_OARS_GUIDELINES

    def test_contains_autonomy(self):
        assert "Autonomy" in MI_OARS_GUIDELINES

    def test_contains_competence(self):
        assert "Competence" in MI_OARS_GUIDELINES

    def test_contains_relatedness(self):
        assert "Relatedness" in MI_OARS_GUIDELINES


# ---------------------------------------------------------------------------
# Phase-specific MI tips
# ---------------------------------------------------------------------------


class TestOnboardingMITips:
    def test_non_empty(self):
        assert len(ONBOARDING_MI_TIPS) > 50

    def test_mentions_explore(self):
        assert "brought them here" in ONBOARDING_MI_TIPS.lower() or "explore" in ONBOARDING_MI_TIPS.lower()

    def test_mentions_affirm_starting(self):
        assert "affirm" in ONBOARDING_MI_TIPS.lower()

    def test_mentions_reflect_concerns(self):
        assert "concern" in ONBOARDING_MI_TIPS.lower() or "reflect" in ONBOARDING_MI_TIPS.lower()


class TestActiveMITips:
    def test_non_empty(self):
        assert len(ACTIVE_MI_TIPS) > 50

    def test_mentions_exercises(self):
        assert "exercise" in ACTIVE_MI_TIPS.lower()

    def test_mentions_consistency(self):
        assert "consistency" in ACTIVE_MI_TIPS.lower() or "consistent" in ACTIVE_MI_TIPS.lower() or "streak" in ACTIVE_MI_TIPS.lower()

    def test_mentions_affirm(self):
        assert "affirm" in ACTIVE_MI_TIPS.lower()


class TestReEngagingMITips:
    def test_non_empty(self):
        assert len(RE_ENGAGING_MI_TIPS) > 50

    def test_mentions_welcome_back(self):
        assert "brought you back" in RE_ENGAGING_MI_TIPS.lower() or "welcome" in RE_ENGAGING_MI_TIPS.lower()

    def test_mentions_courage(self):
        assert "courage" in RE_ENGAGING_MI_TIPS.lower()

    def test_mentions_normalize_gaps(self):
        assert "gap" in RE_ENGAGING_MI_TIPS.lower() or "normalize" in RE_ENGAGING_MI_TIPS.lower()


# ---------------------------------------------------------------------------
# Graph integration tests — prompts contain MI content
# ---------------------------------------------------------------------------


class TestOnboardingGraphPrompt:
    def test_onboarding_prompt_contains_mi(self):
        from app.graphs.onboarding import ONBOARDING_SYSTEM_PROMPT
        assert "Open Questions" in ONBOARDING_SYSTEM_PROMPT
        assert "Affirmations" in ONBOARDING_SYSTEM_PROMPT
        assert "Reflections" in ONBOARDING_SYSTEM_PROMPT
        assert "Summaries" in ONBOARDING_SYSTEM_PROMPT
        assert "Change Talk" in ONBOARDING_SYSTEM_PROMPT
        assert "Resistance Rolling" in ONBOARDING_SYSTEM_PROMPT

    def test_onboarding_prompt_contains_sdt(self):
        from app.graphs.onboarding import ONBOARDING_SYSTEM_PROMPT
        assert "Autonomy" in ONBOARDING_SYSTEM_PROMPT
        assert "Competence" in ONBOARDING_SYSTEM_PROMPT
        assert "Relatedness" in ONBOARDING_SYSTEM_PROMPT

    def test_onboarding_prompt_contains_phase_tips(self):
        from app.graphs.onboarding import ONBOARDING_SYSTEM_PROMPT
        assert "brought them here" in ONBOARDING_SYSTEM_PROMPT.lower() or "onboarding" in ONBOARDING_SYSTEM_PROMPT.lower()


class TestActiveGraphPrompt:
    def test_active_prompt_contains_mi(self):
        from app.graphs.active import ACTIVE_SYSTEM_PROMPT
        assert "Open Questions" in ACTIVE_SYSTEM_PROMPT
        assert "Affirmations" in ACTIVE_SYSTEM_PROMPT
        assert "Reflections" in ACTIVE_SYSTEM_PROMPT
        assert "Summaries" in ACTIVE_SYSTEM_PROMPT

    def test_active_prompt_contains_sdt(self):
        from app.graphs.active import ACTIVE_SYSTEM_PROMPT
        assert "Autonomy" in ACTIVE_SYSTEM_PROMPT
        assert "Competence" in ACTIVE_SYSTEM_PROMPT
        assert "Relatedness" in ACTIVE_SYSTEM_PROMPT


class TestReEngagingGraphPrompt:
    def test_re_engaging_prompt_contains_mi(self):
        from app.graphs.re_engaging import RE_ENGAGING_SYSTEM_PROMPT
        assert "Open Questions" in RE_ENGAGING_SYSTEM_PROMPT
        assert "Affirmations" in RE_ENGAGING_SYSTEM_PROMPT
        assert "Reflections" in RE_ENGAGING_SYSTEM_PROMPT
        assert "Summaries" in RE_ENGAGING_SYSTEM_PROMPT

    def test_re_engaging_prompt_contains_sdt(self):
        from app.graphs.re_engaging import RE_ENGAGING_SYSTEM_PROMPT
        assert "Autonomy" in RE_ENGAGING_SYSTEM_PROMPT
        assert "Competence" in RE_ENGAGING_SYSTEM_PROMPT
        assert "Relatedness" in RE_ENGAGING_SYSTEM_PROMPT

    def test_re_engaging_prompt_contains_phase_tips(self):
        from app.graphs.re_engaging import RE_ENGAGING_SYSTEM_PROMPT
        assert "brought you back" in RE_ENGAGING_SYSTEM_PROMPT.lower() or "welcome" in RE_ENGAGING_SYSTEM_PROMPT.lower()


# ---------------------------------------------------------------------------
# Graph compilation tests
# ---------------------------------------------------------------------------


class TestGraphsCompile:
    def test_onboarding_graph_builds(self):
        from app.graphs.onboarding import build_onboarding_graph

        async def mock_gen(**kwargs):
            return "test"

        graph = build_onboarding_graph(generate_fn=mock_gen)
        assert graph is not None

    def test_active_graph_builds(self):
        from app.graphs.active import build_active_graph

        async def mock_gen(**kwargs):
            return "test"

        graph = build_active_graph(generate_fn=mock_gen)
        assert graph is not None

    def test_re_engaging_graph_builds(self):
        from app.graphs.re_engaging import build_re_engaging_graph

        async def mock_gen(**kwargs):
            return "test"

        graph = build_re_engaging_graph(generate_fn=mock_gen)
        assert graph is not None
