"""Tests for the consent gate API dependency and PATCH endpoint — TICKET-003."""

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.main import app
from app.models.patient import Patient


async def _create_patient(
    session: AsyncSession,
    *,
    external_id: str = "pat-001",
    name: str = "Test Patient",
    logged_in: bool = False,
    consent_given: bool = False,
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name=name,
        logged_in=logged_in,
        consent_given=consent_given,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


class TestConsentPatchEndpoint:
    """Test PATCH /api/patients/{id}/consent endpoint."""

    async def test_grant_consent(self, db_session: AsyncSession):
        """Granting consent sets consent_given=True."""
        patient = await _create_patient(db_session, logged_in=True, consent_given=False)

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.patch(
                    f"/api/patients/{patient.id}/consent",
                    json={"consent_given": True},
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["consent_given"] is True
        finally:
            app.dependency_overrides.clear()

    async def test_revoke_consent(self, db_session: AsyncSession):
        """Revoking consent sets consent_given=False."""
        patient = await _create_patient(
            db_session, external_id="pat-002", logged_in=True, consent_given=True
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.patch(
                    f"/api/patients/{patient.id}/consent",
                    json={"consent_given": False},
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["consent_given"] is False
        finally:
            app.dependency_overrides.clear()

    async def test_consent_nonexistent_patient_returns_404(self, db_session: AsyncSession):
        """PATCH on nonexistent patient returns 404."""
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.patch(
                    "/api/patients/99999/consent",
                    json={"consent_given": True},
                )
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()


class TestConsentGateDependency:
    """Test the FastAPI dependency that gates endpoints behind consent."""

    async def test_gated_endpoint_blocks_without_consent(self, db_session: AsyncSession):
        """An endpoint protected by require_consent returns 403 when consent missing."""
        patient = await _create_patient(
            db_session, external_id="pat-010", logged_in=False, consent_given=False
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    f"/api/coach/interact/{patient.id}",
                )
            assert resp.status_code == 403
            assert "consent" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    async def test_gated_endpoint_allows_with_consent(self, db_session: AsyncSession):
        """An endpoint protected by require_consent proceeds when consent is given."""
        patient = await _create_patient(
            db_session, external_id="pat-011", logged_in=True, consent_given=True
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    f"/api/coach/interact/{patient.id}",
                )
            # Should get 200 (the stub endpoint returns success)
            assert resp.status_code == 200
        finally:
            app.dependency_overrides.clear()
