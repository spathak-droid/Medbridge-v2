"""Data retention service for HIPAA compliance.

Handles automated cleanup of old patient data based on configurable retention periods.
Default retention: 3 years for patient records, 1 year for audit logs.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.direct_message import DirectMessage
from app.models.message import Message
from app.models.schedule_event import ScheduleEvent

logger = logging.getLogger(__name__)

# Retention periods (configurable via env)
PATIENT_DATA_RETENTION_DAYS = int(os.getenv("PATIENT_DATA_RETENTION_DAYS", str(365 * 3)))  # 3 years
AUDIT_LOG_RETENTION_DAYS = int(os.getenv("AUDIT_LOG_RETENTION_DAYS", str(365 * 6)))  # 6 years (HIPAA minimum)
MESSAGE_RETENTION_DAYS = int(os.getenv("MESSAGE_RETENTION_DAYS", str(365 * 3)))  # 3 years


async def cleanup_expired_data(session: AsyncSession) -> dict:
    """Run data retention cleanup. Returns counts of deleted records."""
    now = datetime.now(timezone.utc)
    results = {}

    # 1. Delete old coach messages (conversation messages)
    message_cutoff = now - timedelta(days=MESSAGE_RETENTION_DAYS)
    result = await session.execute(
        delete(Message).where(Message.created_at < message_cutoff)
    )
    results["messages_deleted"] = result.rowcount

    # 2. Delete old direct messages
    result = await session.execute(
        delete(DirectMessage).where(DirectMessage.created_at < message_cutoff)
    )
    results["direct_messages_deleted"] = result.rowcount

    # 3. Delete old schedule events (completed/skipped only)
    schedule_cutoff = now - timedelta(days=PATIENT_DATA_RETENTION_DAYS)
    result = await session.execute(
        delete(ScheduleEvent).where(
            ScheduleEvent.scheduled_at < schedule_cutoff,
            ScheduleEvent.status.in_(["SENT", "SKIPPED"]),
        )
    )
    results["schedule_events_deleted"] = result.rowcount

    # 4. Delete old audit logs (keep 6 years minimum per HIPAA)
    audit_cutoff = now - timedelta(days=AUDIT_LOG_RETENTION_DAYS)
    result = await session.execute(
        delete(AuditLog).where(AuditLog.timestamp < audit_cutoff)
    )
    results["audit_logs_deleted"] = result.rowcount

    await session.commit()

    logger.info(
        "Data retention cleanup completed: %s",
        ", ".join(f"{k}={v}" for k, v in results.items()),
    )
    return results


async def get_retention_stats(session: AsyncSession) -> dict:
    """Get counts of records by age for retention monitoring."""
    now = datetime.now(timezone.utc)
    one_year_ago = now - timedelta(days=365)
    three_years_ago = now - timedelta(days=365 * 3)

    stats = {}

    # Message counts by age
    result = await session.execute(select(func.count(Message.id)))
    stats["total_messages"] = result.scalar() or 0

    result = await session.execute(
        select(func.count(Message.id)).where(Message.created_at < one_year_ago)
    )
    stats["messages_older_than_1y"] = result.scalar() or 0

    result = await session.execute(
        select(func.count(Message.id)).where(Message.created_at < three_years_ago)
    )
    stats["messages_older_than_3y"] = result.scalar() or 0

    # Audit log counts
    result = await session.execute(select(func.count(AuditLog.id)))
    stats["total_audit_logs"] = result.scalar() or 0

    return stats
