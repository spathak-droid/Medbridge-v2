"""Exercise completion log — tracks when patients complete individual exercises."""

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"
    __table_args__ = (
        UniqueConstraint("patient_id", "exercise_id", "completed_date", name="uq_patient_exercise_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    exercise_id: Mapped[str] = mapped_column(String, nullable=False)
    completed_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
