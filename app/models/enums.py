"""Shared enums for domain models."""

import enum


class PatientPhase(str, enum.Enum):
    PENDING = "PENDING"
    ONBOARDING = "ONBOARDING"
    ACTIVE = "ACTIVE"
    RE_ENGAGING = "RE_ENGAGING"
    DORMANT = "DORMANT"


class MessageRole(str, enum.Enum):
    PATIENT = "PATIENT"
    COACH = "COACH"
    SYSTEM = "SYSTEM"


class SafetyStatus(str, enum.Enum):
    PASSED = "PASSED"
    BLOCKED = "BLOCKED"
    FALLBACK = "FALLBACK"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class EventType(str, enum.Enum):
    DAY_2 = "DAY_2"
    DAY_5 = "DAY_5"
    DAY_7 = "DAY_7"
    REMINDER = "REMINDER"
    WEEKLY_DIGEST = "WEEKLY_DIGEST"


class ScheduleStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    SKIPPED = "SKIPPED"


class SafetyClassification(str, enum.Enum):
    SAFE = "SAFE"
    CLINICAL_CONTENT = "CLINICAL_CONTENT"
    CRISIS = "CRISIS"


class AlertUrgency(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    NORMAL = "NORMAL"


class AlertStatus(str, enum.Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"


# Re-export for backward compatibility
EventStatus = ScheduleStatus
