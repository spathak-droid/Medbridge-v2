"""HIPAA audit log database model with hash chain for tamper detection."""

import hashlib
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    event = Column(String(50), nullable=False, default="phi_access")
    user_uid = Column(String(255), nullable=False, default="anonymous")
    user_role = Column(String(50), nullable=False, default="unknown")
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False)
    patient_id = Column(String(50), nullable=True)
    status_code = Column(Integer, nullable=False)
    duration_ms = Column(Integer, nullable=False)
    client_ip = Column(String(45), nullable=False, default="unknown")
    # Hash chain: SHA-256 of (previous_hash + this entry's data)
    entry_hash = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=False, default="genesis")

    @staticmethod
    def compute_hash(previous_hash: str, data: dict) -> str:
        """Compute SHA-256 hash for tamper detection chain."""
        payload = f"{previous_hash}|{data['timestamp']}|{data['user_uid']}|{data['method']}|{data['path']}|{data['status_code']}"
        return hashlib.sha256(payload.encode()).hexdigest()
