"""Tests for alerts API endpoints — TICKET-017.

GET /api/alerts — returns alerts sorted by urgency (CRITICAL first) then recency.
PATCH /api/alerts/{id}/acknowledge — marks an alert as acknowledged.
"""

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.main import app
from app.models.alert import Alert
from app.models.enums import AlertStatus, AlertUrgency
from app.models.patient import Patient


async def _seed_patient(
    session: AsyncSession,
    *,
    external_id: str = "alert-pat-001",
    name: str = "Alert Patient",
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name=name,
        consent_given=True,
        logged_in=True,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def _seed_alert(
    session: AsyncSession,
    patient_id: int,
    *,
    reason: str = "Clinical content escalation",
    urgency: AlertUrgency = AlertUrgency.NORMAL,
    status: AlertStatus = AlertStatus.NEW,
) -> Alert:
    alert = Alert(
        patient_id=patient_id,
        reason=reason,
        urgency=urgency,
        status=status,
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert


class TestGetAlerts:
    """GET /api/alerts."""

    async def test_returns_alerts_sorted_by_urgency_and_recency(self, db_session: AsyncSession):
        """Alerts are sorted CRITICAL first, then by most recent."""
        patient = await _seed_patient(db_session)
        await _seed_alert(
            db_session, patient.id, reason="Normal alert", urgency=AlertUrgency.NORMAL
        )
        await _seed_alert(
            db_session, patient.id, reason="Crisis alert", urgency=AlertUrgency.CRITICAL
        )
        await _seed_alert(
            db_session, patient.id, reason="High alert", urgency=AlertUrgency.HIGH
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/alerts")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 3
            assert data[0]["urgency"] == "CRITICAL"
            assert data[1]["urgency"] == "HIGH"
            assert data[2]["urgency"] == "NORMAL"
        finally:
            app.dependency_overrides.clear()

    async def test_alert_contains_required_fields(self, db_session: AsyncSession):
        """Each alert includes patient name, reason, urgency, status, timestamp."""
        patient = await _seed_patient(db_session, name="Jane Doe")
        await _seed_alert(db_session, patient.id, reason="Mental health crisis")

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/alerts")
            data = resp.json()
            alert = data[0]
            assert alert["patient_name"] == "Jane Doe"
            assert alert["patient_id"] == patient.id
            assert alert["reason"] == "Mental health crisis"
            assert alert["urgency"] == "NORMAL"
            assert alert["status"] == "NEW"
            assert "created_at" in alert
        finally:
            app.dependency_overrides.clear()

    async def test_empty_alerts_returns_empty_list(self, db_session: AsyncSession):
        """When no alerts exist, returns empty list."""
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/alerts")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            app.dependency_overrides.clear()

    async def test_acknowledged_alerts_sorted_after_new(self, db_session: AsyncSession):
        """Acknowledged alerts appear after NEW alerts of same urgency."""
        patient = await _seed_patient(db_session)
        await _seed_alert(
            db_session,
            patient.id,
            reason="Acknowledged",
            urgency=AlertUrgency.HIGH,
            status=AlertStatus.ACKNOWLEDGED,
        )
        await _seed_alert(
            db_session,
            patient.id,
            reason="New alert",
            urgency=AlertUrgency.HIGH,
            status=AlertStatus.NEW,
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/alerts")
            data = resp.json()
            assert data[0]["status"] == "NEW"
            assert data[1]["status"] == "ACKNOWLEDGED"
        finally:
            app.dependency_overrides.clear()


class TestAcknowledgeAlert:
    """PATCH /api/alerts/{id}/acknowledge."""

    async def test_acknowledge_alert_updates_status(self, db_session: AsyncSession):
        """Acknowledging an alert sets status to ACKNOWLEDGED and sets acknowledged_at."""
        patient = await _seed_patient(db_session, external_id="ack-pat-001")
        alert = await _seed_alert(db_session, patient.id)

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.patch(f"/api/alerts/{alert.id}/acknowledge")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ACKNOWLEDGED"
            assert data["acknowledged_at"] is not None
        finally:
            app.dependency_overrides.clear()

    async def test_acknowledge_nonexistent_alert_returns_404(self, db_session: AsyncSession):
        """PATCH on nonexistent alert returns 404."""
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.patch("/api/alerts/99999/acknowledge")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_acknowledge_already_acknowledged_is_idempotent(self, db_session: AsyncSession):
        """Acknowledging an already acknowledged alert returns 200 (idempotent)."""
        patient = await _seed_patient(db_session, external_id="ack-pat-002")
        alert = await _seed_alert(
            db_session, patient.id, status=AlertStatus.ACKNOWLEDGED
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.patch(f"/api/alerts/{alert.id}/acknowledge")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ACKNOWLEDGED"
        finally:
            app.dependency_overrides.clear()
