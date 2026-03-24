from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import PatientPhase


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phase: Mapped[PatientPhase] = mapped_column(
        Enum(PatientPhase), nullable=False, default=PatientPhase.PENDING
    )
    consent_given: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    program_type: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    logged_in: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unanswered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_unanswered_message_id: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, default=None
    )
    phase_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
