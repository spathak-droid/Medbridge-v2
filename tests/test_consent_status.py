"""Tests for GET /api/patients/{id}/consent endpoint — TICKET-019."""

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.main import app
from app.middleware.auth import AuthenticatedUser, get_current_user
from app.api.dependencies import require_own_patient_data, set_audit_user
from app.models.patient import Patient

_fake_user = AuthenticatedUser(uid="test-uid", email="test@test.com", role="clinician")


async def _create_patient(
    session: AsyncSession,
    *,
    external_id: str = "pat-100",
    name: str = "Consent Test Patient",
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


class TestGetConsentStatus:
    """Test GET /api/patients/{id}/consent endpoint."""

    async def test_returns_consent_false_for_unconsented_patient(self, db_session: AsyncSession):
        """GET returns consent_given=False for patient who hasn't consented."""
        patient = await _create_patient(db_session, logged_in=True, consent_given=False)

        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_current_user] = lambda: _fake_user
        app.dependency_overrides[require_own_patient_data] = lambda: _fake_user
        app.dependency_overrides[set_audit_user] = lambda: _fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(f"/api/patients/{patient.id}/consent")
            assert resp.status_code == 200
            data = resp.json()
            assert data["consent_given"] is False
        finally:
            app.dependency_overrides.clear()

    async def test_returns_consent_true_for_consented_patient(self, db_session: AsyncSession):
        """GET returns consent_given=True for patient who has consented."""
        patient = await _create_patient(
            db_session, external_id="pat-101", logged_in=True, consent_given=True
        )

        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_current_user] = lambda: _fake_user
        app.dependency_overrides[require_own_patient_data] = lambda: _fake_user
        app.dependency_overrides[set_audit_user] = lambda: _fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(f"/api/patients/{patient.id}/consent")
            assert resp.status_code == 200
            data = resp.json()
            assert data["consent_given"] is True
        finally:
            app.dependency_overrides.clear()

    async def test_returns_404_for_nonexistent_patient(self, db_session: AsyncSession):
        """GET on nonexistent patient returns 404."""
        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_current_user] = lambda: _fake_user
        app.dependency_overrides[require_own_patient_data] = lambda: _fake_user
        app.dependency_overrides[set_audit_user] = lambda: _fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/patients/99999/consent")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_consent_grant_then_get_reflects_update(self, db_session: AsyncSession):
        """PATCH consent then GET reflects updated status."""
        patient = await _create_patient(
            db_session, external_id="pat-102", logged_in=True, consent_given=False
        )

        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_current_user] = lambda: _fake_user
        app.dependency_overrides[require_own_patient_data] = lambda: _fake_user
        app.dependency_overrides[set_audit_user] = lambda: _fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Grant consent
                resp = await client.patch(
                    f"/api/patients/{patient.id}/consent",
                    json={"consent_given": True},
                )
                assert resp.status_code == 200

                # GET should now return True
                resp = await client.get(f"/api/patients/{patient.id}/consent")
                assert resp.status_code == 200
                assert resp.json()["consent_given"] is True
        finally:
            app.dependency_overrides.clear()

    async def test_consent_revoke_then_get_reflects_update(self, db_session: AsyncSession):
        """Revoking consent then GET reflects revoked status."""
        patient = await _create_patient(
            db_session, external_id="pat-103", logged_in=True, consent_given=True
        )

        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_current_user] = lambda: _fake_user
        app.dependency_overrides[require_own_patient_data] = lambda: _fake_user
        app.dependency_overrides[set_audit_user] = lambda: _fake_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Revoke consent
                resp = await client.patch(
                    f"/api/patients/{patient.id}/consent",
                    json={"consent_given": False},
                )
                assert resp.status_code == 200

                # GET should now return False
                resp = await client.get(f"/api/patients/{patient.id}/consent")
                assert resp.status_code == 200
                assert resp.json()["consent_given"] is False
        finally:
            app.dependency_overrides.clear()
