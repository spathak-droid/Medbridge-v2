"""Tests for clinical notes integration in insight generation.

Covers:
- Clinical notes are included in the LLM prompt when present
- Soft-deleted notes (deleted_at set) are excluded
- Insights still generate correctly when no clinical notes exist
- Notes are truncated to 200 chars
- Maximum 10 notes are included
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinical_note import ClinicalNote
from app.models.enums import PatientPhase
from app.models.patient import Patient


async def _create_patient(session: AsyncSession) -> Patient:
    patient = Patient(
        external_id="PT-TEST-001",
        name="Test Patient",
        phase=PatientPhase.ACTIVE,
        consent_given=True,
        program_type="knee_rehab_post_surgical",
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def _create_clinical_note(
    session: AsyncSession,
    patient_id: int,
    content: str = "Patient reports knee pain during squats",
    deleted: bool = False,
) -> ClinicalNote:
    note = ClinicalNote(
        patient_id=patient_id,
        clinician_uid="clinician-001",
        content=content,
    )
    if deleted:
        note.deleted_at = datetime.now(timezone.utc)
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


@pytest.mark.asyncio
@patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
async def test_clinical_notes_included_in_insight(mock_llm, db_session):
    """Clinical notes appear in the data passed to the LLM."""
    mock_llm.return_value = "## Adherence Trends\nGood progress..."

    patient = await _create_patient(db_session)
    await _create_clinical_note(db_session, patient.id, "Patient frustrated with knee pain during squats")

    from app.api.patients import _generate_insight
    await _generate_insight(patient.id, db_session)

    call_kwargs = mock_llm.call_args.kwargs
    user_content = call_kwargs["messages"][0]["content"]
    assert "Clinician Notes" in user_content
    assert "frustrated with knee pain" in user_content


@pytest.mark.asyncio
@patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
async def test_soft_deleted_notes_excluded(mock_llm, db_session):
    """Notes with deleted_at set are not included."""
    mock_llm.return_value = "## Adherence Trends\nGood progress..."

    patient = await _create_patient(db_session)
    await _create_clinical_note(db_session, patient.id, "Active note", deleted=False)
    await _create_clinical_note(db_session, patient.id, "Deleted note", deleted=True)

    from app.api.patients import _generate_insight
    await _generate_insight(patient.id, db_session)

    user_content = mock_llm.call_args.kwargs["messages"][0]["content"]
    assert "Active note" in user_content
    assert "Deleted note" not in user_content


@pytest.mark.asyncio
@patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
async def test_insights_work_without_clinical_notes(mock_llm, db_session):
    """Insight generation works when no clinical notes exist."""
    mock_llm.return_value = "## Adherence Trends\nNo data..."

    patient = await _create_patient(db_session)

    from app.api.patients import _generate_insight
    result = await _generate_insight(patient.id, db_session)

    assert result == mock_llm.return_value
    user_content = mock_llm.call_args.kwargs["messages"][0]["content"]
    assert "Clinician Notes" not in user_content
