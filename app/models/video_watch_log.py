"""Video watch log — tracks when patients watch exercise videos and their progress."""

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VideoWatchLog(Base):
    __tablename__ = "video_watch_logs"
    __table_args__ = (
        UniqueConstraint("patient_id", "exercise_id", "watched_date", name="uq_patient_video_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    exercise_id: Mapped[str] = mapped_column(String, nullable=False)
    watch_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    watched_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
