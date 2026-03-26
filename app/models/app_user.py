"""App-level user record — stores Firebase UID ↔ role mapping.

Firebase custom claims require a service account to set, which isn't available
in all deployment environments.  This table is the backend's source of truth
for user roles instead.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppUser(Base):
    __tablename__ = "app_users"

    firebase_uid: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str] = mapped_column(String, nullable=False, default="patient")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
