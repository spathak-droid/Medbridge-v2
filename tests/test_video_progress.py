"""Tests for video progress tracking and blended adherence."""

import pytest
from datetime import date

from app.models.video_watch_log import VideoWatchLog


class TestVideoWatchLogModel:
    """Test VideoWatchLog model creation."""

    def test_model_fields(self):
        log = VideoWatchLog(
            patient_id=1,
            exercise_id="kpr-1",
            watch_percentage=85.5,
            watched_date=date(2026, 3, 28),
        )
        assert log.patient_id == 1
        assert log.exercise_id == "kpr-1"
        assert log.watch_percentage == 85.5
        assert log.watched_date == date(2026, 3, 28)

    def test_is_watched_threshold(self):
        """80% threshold for 'watched' status."""
        log_below = VideoWatchLog(watch_percentage=79.9)
        log_at = VideoWatchLog(watch_percentage=80.0)
        log_above = VideoWatchLog(watch_percentage=95.0)
        assert log_below.watch_percentage < 80.0
        assert log_at.watch_percentage >= 80.0
        assert log_above.watch_percentage >= 80.0


class TestBlendedAdherence:
    """Test blended adherence score calculation logic."""

    def test_blended_score_both_complete(self):
        comp_pct = 100.0
        vid_pct = 100.0
        blended = (comp_pct + vid_pct) / 2
        assert blended == 100.0

    def test_blended_score_only_exercise(self):
        comp_pct = 100.0
        vid_pct = 0.0
        blended = (comp_pct + vid_pct) / 2
        assert blended == 50.0

    def test_blended_score_only_video(self):
        comp_pct = 0.0
        vid_pct = 100.0
        blended = (comp_pct + vid_pct) / 2
        assert blended == 50.0

    def test_blended_score_neither(self):
        comp_pct = 0.0
        vid_pct = 0.0
        blended = (comp_pct + vid_pct) / 2
        assert blended == 0.0


class TestProgramData:
    """Test that programs have valid video IDs."""

    def test_all_programs_have_video_ids(self):
        from app.data.programs import PROGRAMS
        for prog_type, prog in PROGRAMS.items():
            for ex in prog["exercises"]:
                assert "video_id" in ex, f"Exercise {ex['id']} in {prog_type} missing video_id"
                assert len(ex["video_id"]) == 11, f"Exercise {ex['id']} has invalid YouTube video ID: {ex['video_id']}"

    def test_all_exercises_have_unique_ids(self):
        from app.data.programs import PROGRAMS
        all_ids = []
        for prog in PROGRAMS.values():
            for ex in prog["exercises"]:
                all_ids.append(ex["id"])
        assert len(all_ids) == len(set(all_ids)), "Duplicate exercise IDs found"

    def test_program_count(self):
        from app.data.programs import PROGRAMS
        assert len(PROGRAMS) == 16

    def test_patient_program_map_valid(self):
        from app.data.programs import PROGRAMS, PATIENT_PROGRAM_MAP
        for patient, prog_type in PATIENT_PROGRAM_MAP.items():
            assert prog_type in PROGRAMS, f"Patient {patient} mapped to non-existent program {prog_type}"
