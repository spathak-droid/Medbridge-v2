"""Seed script for demo data.

Run: python -m scripts.seed_demo

Creates 5 patients with realistic conversation histories, goals, alerts,
and schedule events to showcase every phase of the coaching platform.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.database import Base, engine, async_session_factory
from app.models.alert import Alert
from app.models.conversation import Conversation
from app.models.enums import (
    AlertStatus,
    AlertUrgency,
    EventType,
    MessageRole,
    PatientPhase,
    SafetyStatus,
    ScheduleStatus,
)
from app.models.goal import Goal
from app.models.message import Message
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent

NOW = datetime.now(timezone.utc)


def _ago(**kwargs) -> datetime:
    return NOW - timedelta(**kwargs)


async def seed():
    # Drop and recreate all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as s:
        # ── Patient 1: Sarah Chen — ACTIVE, knee rehab, 85% adherence ──
        sarah = Patient(
            external_id="PT-SARAH-001",
            name="Sarah Chen",
            phase=PatientPhase.ACTIVE,
            program_type="knee_rehab_post_surgical",
            consent_given=True,
            consented_at=_ago(days=21),
            logged_in=True,
            unanswered_count=0,
            phase_updated_at=_ago(days=19),
            created_at=_ago(days=22),
            updated_at=NOW,
        )
        s.add(sarah)
        await s.flush()

        # Sarah's confirmed goal
        sarah_goal = Goal(
            patient_id=sarah.id,
            raw_text="Complete my knee rehab exercises 5 times a week for 30 minutes each session",
            structured_goal={
                "activity": "knee rehab exercises",
                "frequency": 5,
                "frequency_unit": "week",
                "duration": 30,
                "duration_unit": "minutes",
            },
            confirmed=True,
            created_at=_ago(days=19),
        )
        s.add(sarah_goal)

        # Sarah's onboarding conversation
        sarah_conv1 = Conversation(
            patient_id=sarah.id,
            phase_at_creation=PatientPhase.ONBOARDING,
            started_at=_ago(days=21),
        )
        s.add(sarah_conv1)
        await s.flush()

        sarah_onboarding_msgs = [
            (MessageRole.COACH, "Hi Sarah! Welcome to MedBridge Coach. I'm here to support your recovery after your knee surgery. I can see you've been assigned a post-surgical knee rehabilitation program with exercises like Quad Sets, Straight Leg Raises, and Heel Slides.\n\nTo get started, I'd love to help you set a personal exercise goal. What would you like to aim for with your rehab?", _ago(days=21)),
            (MessageRole.PATIENT, "Hi! I'm excited to get started. I'd like to do my exercises at least 5 times a week. My surgeon said consistency is key for recovery.", _ago(days=21, minutes=-5)),
            (MessageRole.COACH, "That's a great mindset, Sarah! Consistency really is the foundation of a good recovery. Let me set that as your goal.", _ago(days=21, minutes=-10)),
        ]
        for role, content, ts in sarah_onboarding_msgs:
            tool_calls = None
            if "Let me set that" in content:
                tool_calls = [{"name": "set_goal", "args": {"goal_text": sarah_goal.raw_text}}]
            s.add(Message(
                conversation_id=sarah_conv1.id,
                role=role,
                content=content,
                safety_status=SafetyStatus.PASSED,
                tool_calls=tool_calls,
                created_at=ts,
            ))

        # Sarah's active conversation (recent check-in)
        sarah_conv2 = Conversation(
            patient_id=sarah.id,
            phase_at_creation=PatientPhase.ACTIVE,
            started_at=_ago(days=2),
        )
        s.add(sarah_conv2)
        await s.flush()

        sarah_active_msgs = [
            (MessageRole.COACH, "Great job on your 7-day streak, Sarah! Your consistency is really paying off. Your adherence is at 85.7% which is excellent for week 3.\n\nHow are the Wall Squats feeling? Those are the most challenging exercise in your program right now.", _ago(days=2)),
            (MessageRole.PATIENT, "Thanks! The wall squats are getting easier actually. I can hold for about 8 seconds now. My knee feels so much stronger.", _ago(days=2, minutes=-15)),
            (MessageRole.COACH, "That's wonderful progress! Going from the initial hold to 8 seconds shows real strength gains. Keep listening to your body — if you feel confident, you can try holding for a second or two longer each session.\n\nYour Quad Sets completion is at 95% which is outstanding. Keep up this incredible work!", _ago(days=2, minutes=-20)),
            (MessageRole.PATIENT, "I will! Quick question - should I be doing the calf raises before or after the wall squats?", _ago(hours=5)),
            (MessageRole.COACH, "Great question! I'd recommend doing Calf Raises after Wall Squats. The wall squats are more demanding on your quadriceps, so doing them first when your muscles are fresh helps you maintain good form. The calf raises are a nice way to finish since they're lighter and can help cool down your legs.\n\nKeep up the amazing work, Sarah!", _ago(hours=5, minutes=-5)),
        ]
        for role, content, ts in sarah_active_msgs:
            s.add(Message(
                conversation_id=sarah_conv2.id,
                role=role,
                content=content,
                safety_status=SafetyStatus.PASSED,
                created_at=ts,
            ))

        # Sarah's schedule events
        for event_type, delta, status in [
            (EventType.DAY_2, timedelta(days=17), ScheduleStatus.SENT),
            (EventType.DAY_5, timedelta(days=14), ScheduleStatus.SENT),
            (EventType.DAY_7, timedelta(days=12), ScheduleStatus.PENDING),
        ]:
            s.add(ScheduleEvent(
                patient_id=sarah.id,
                event_type=event_type,
                scheduled_at=_ago(days=19) + delta,
                executed_at=(_ago(days=19) + delta) if status == ScheduleStatus.SENT else None,
                message=f"{event_type.value} check-in for Sarah",
                status=status,
            ))

        # ── Patient 2: Marcus Johnson — ONBOARDING, just started ──
        marcus = Patient(
            external_id="PT-MARCUS-002",
            name="Marcus Johnson",
            phase=PatientPhase.ONBOARDING,
            program_type="fall_prevention",
            consent_given=True,
            consented_at=_ago(days=1),
            logged_in=True,
            unanswered_count=0,
            phase_updated_at=_ago(days=1),
            created_at=_ago(days=2),
            updated_at=NOW,
        )
        s.add(marcus)
        await s.flush()

        # Marcus has an unconfirmed goal
        marcus_goal = Goal(
            patient_id=marcus.id,
            raw_text="Practice my balance exercises daily for 15 minutes to prevent falls",
            structured_goal={
                "activity": "balance exercises",
                "frequency": 1,
                "frequency_unit": "day",
                "duration": 15,
                "duration_unit": "minutes",
            },
            confirmed=False,
            created_at=_ago(hours=12),
        )
        s.add(marcus_goal)

        marcus_conv = Conversation(
            patient_id=marcus.id,
            phase_at_creation=PatientPhase.ONBOARDING,
            started_at=_ago(days=1),
        )
        s.add(marcus_conv)
        await s.flush()

        marcus_msgs = [
            (MessageRole.COACH, "Welcome, Marcus! I'm your MedBridge exercise coach. I'm here to help you stay on track with your Fall Prevention & Balance program.\n\nYour program includes exercises like Tandem Stance, Heel-to-Toe Walk, and Single Leg Stand — all designed to improve your balance and confidence.\n\nWhat would you like your exercise goal to be?", _ago(days=1)),
            (MessageRole.PATIENT, "Hi there. I've been having some balance issues lately and my doctor recommended this program. I'd like to do the exercises every day for about 15 minutes if that's realistic.", _ago(hours=12)),
            (MessageRole.COACH, "That's a very realistic and achievable goal, Marcus! Fifteen minutes daily is perfect for building the balance and stability your body needs. Let me save that as your goal.", _ago(hours=12, minutes=-5)),
        ]
        for role, content, ts in marcus_msgs:
            tool_calls = None
            if "save that as your goal" in content:
                tool_calls = [{"name": "set_goal", "args": {"goal_text": marcus_goal.raw_text}}]
            s.add(Message(
                conversation_id=marcus_conv.id,
                role=role,
                content=content,
                safety_status=SafetyStatus.PASSED,
                tool_calls=tool_calls,
                created_at=ts,
            ))

        # ── Patient 3: Emily Rodriguez — DORMANT, shoulder rehab, declining ──
        emily = Patient(
            external_id="PT-EMILY-003",
            name="Emily Rodriguez",
            phase=PatientPhase.DORMANT,
            program_type="shoulder_rehab",
            consent_given=True,
            consented_at=_ago(days=28),
            logged_in=True,
            unanswered_count=3,
            phase_updated_at=_ago(days=5),
            created_at=_ago(days=30),
            updated_at=_ago(days=5),
        )
        s.add(emily)
        await s.flush()

        emily_goal = Goal(
            patient_id=emily.id,
            raw_text="Do my shoulder exercises 4 times a week to regain full range of motion",
            structured_goal={
                "activity": "shoulder exercises",
                "frequency": 4,
                "frequency_unit": "week",
                "duration": None,
                "duration_unit": None,
            },
            confirmed=True,
            created_at=_ago(days=26),
        )
        s.add(emily_goal)

        emily_conv = Conversation(
            patient_id=emily.id,
            phase_at_creation=PatientPhase.ONBOARDING,
            started_at=_ago(days=28),
        )
        s.add(emily_conv)
        await s.flush()

        emily_msgs = [
            (MessageRole.COACH, "Hi Emily! Welcome to MedBridge Coach. I'm here to support your shoulder rehabilitation journey. Your program includes exercises like Pendulum Swings, Wall Walks, and External Rotation.\n\nWhat exercise goal would you like to set?", _ago(days=28)),
            (MessageRole.PATIENT, "I want to get my full range of motion back. I'll try to do the exercises 4 times a week.", _ago(days=26)),
            (MessageRole.COACH, "That's a solid goal, Emily! Four times a week gives your shoulder enough stimulus for recovery while allowing rest days. Let me set that for you.", _ago(days=26, minutes=-5)),
            (MessageRole.PATIENT, "Sounds good, let's do it!", _ago(days=26, minutes=-10)),
            (MessageRole.COACH, "Your shoulder program is off to a great start this week! You've completed 5 out of 7 days — that's excellent dedication.\n\nHow is the External Rotation exercise feeling? That one can be tricky at first.", _ago(days=20)),
            (MessageRole.PATIENT, "It's okay but my shoulder has been really sore. I'm not sure if I should push through it.", _ago(days=19)),
            (MessageRole.COACH, "I appreciate you sharing that, Emily. Some soreness after exercise can be normal, but I want to make sure you're comfortable. For specific questions about pain levels, please check in with your care team — they can give you personalized medical advice.\n\nIn the meantime, you might find the Pendulum Swings helpful as a gentle warm-up before the other exercises.", _ago(days=19, minutes=-5)),
            (MessageRole.COACH, "Hi Emily! Just checking in — it's been a few days since we last chatted. How are your exercises going? Even a short session counts toward your goal!", _ago(days=14)),
            (MessageRole.COACH, "Hey Emily, I noticed you haven't logged any exercises this week. No pressure at all — I'm here whenever you're ready to chat. Is there anything I can help with to make getting back on track easier?", _ago(days=10)),
            (MessageRole.COACH, "Hi Emily, it's been a while and I want you to know I'm still here for you. Your care team has been notified so they can check in as well. Whenever you're ready to restart, even one exercise is a great first step.", _ago(days=5)),
        ]
        for role, content, ts in emily_msgs:
            tool_calls = None
            if "Let me set that" in content:
                tool_calls = [{"name": "set_goal", "args": {"goal_text": emily_goal.raw_text}}]
            s.add(Message(
                conversation_id=emily_conv.id,
                role=role,
                content=content,
                safety_status=SafetyStatus.PASSED,
                tool_calls=tool_calls,
                created_at=ts,
            ))

        # Emily's alerts
        s.add(Alert(
            patient_id=emily.id,
            reason="Patient has 3 unanswered messages. Transitioned to DORMANT.",
            urgency=AlertUrgency.HIGH,
            status=AlertStatus.NEW,
            created_at=_ago(days=5),
        ))
        s.add(Alert(
            patient_id=emily.id,
            reason="Adherence dropped below 55% (currently 52.4%). Declining trend over 3 weeks.",
            urgency=AlertUrgency.NORMAL,
            status=AlertStatus.NEW,
            created_at=_ago(days=8),
        ))

        # Emily's schedule events
        for event_type, offset_days, status in [
            (EventType.DAY_2, 2, ScheduleStatus.SENT),
            (EventType.DAY_5, 5, ScheduleStatus.SENT),
            (EventType.DAY_7, 7, ScheduleStatus.SENT),
        ]:
            s.add(ScheduleEvent(
                patient_id=emily.id,
                event_type=event_type,
                scheduled_at=_ago(days=26 - offset_days),
                executed_at=_ago(days=26 - offset_days),
                message=f"{event_type.value} check-in for Emily",
                status=status,
            ))

        # ── Patient 4: James Wilson — PENDING, no consent yet ──
        james = Patient(
            external_id="PT-JAMES-004",
            name="James Wilson",
            phase=PatientPhase.PENDING,
            consent_given=False,
            consented_at=None,
            logged_in=True,
            unanswered_count=0,
            phase_updated_at=None,
            created_at=_ago(days=3),
            updated_at=_ago(days=3),
        )
        s.add(james)
        await s.flush()
        # James has no conversations, goals, or events

        # ── Patient 5: Aisha Patel — RE_ENGAGING, lower back, returning ──
        aisha = Patient(
            external_id="PT-AISHA-005",
            name="Aisha Patel",
            phase=PatientPhase.RE_ENGAGING,
            program_type="lower_back_rehab",
            consent_given=True,
            consented_at=_ago(days=35),
            logged_in=True,
            unanswered_count=0,
            phase_updated_at=_ago(days=2),
            created_at=_ago(days=35),
            updated_at=NOW,
        )
        s.add(aisha)
        await s.flush()

        aisha_goal = Goal(
            patient_id=aisha.id,
            raw_text="Strengthen my lower back with daily exercises for 20 minutes",
            structured_goal={
                "activity": "lower back exercises",
                "frequency": 1,
                "frequency_unit": "day",
                "duration": 20,
                "duration_unit": "minutes",
            },
            confirmed=True,
            created_at=_ago(days=32),
        )
        s.add(aisha_goal)

        # Aisha's original conversation
        aisha_conv1 = Conversation(
            patient_id=aisha.id,
            phase_at_creation=PatientPhase.ONBOARDING,
            started_at=_ago(days=35),
        )
        s.add(aisha_conv1)
        await s.flush()

        aisha_onboard_msgs = [
            (MessageRole.COACH, "Welcome, Aisha! I'm here to support your lower back rehabilitation. Your program includes Cat-Cow, Bird-Dog, Pelvic Tilts, Bridges, and Dead Bugs.\n\nLet's set a goal together. What would you like to work toward?", _ago(days=35)),
            (MessageRole.PATIENT, "I need to get my back stronger. I sit at a desk all day and the pain has been really limiting. I'll do the exercises daily for 20 minutes.", _ago(days=32)),
            (MessageRole.COACH, "That's a wonderful commitment, Aisha! Daily 20-minute sessions will make a big difference for desk-related back issues. Let me save that goal.", _ago(days=32, minutes=-5)),
        ]
        for role, content, ts in aisha_onboard_msgs:
            tool_calls = None
            if "save that goal" in content:
                tool_calls = [{"name": "set_goal", "args": {"goal_text": aisha_goal.raw_text}}]
            s.add(Message(
                conversation_id=aisha_conv1.id,
                role=role,
                content=content,
                safety_status=SafetyStatus.PASSED,
                tool_calls=tool_calls,
                created_at=ts,
            ))

        # Aisha's re-engagement conversation
        aisha_conv2 = Conversation(
            patient_id=aisha.id,
            phase_at_creation=PatientPhase.RE_ENGAGING,
            started_at=_ago(days=2),
        )
        s.add(aisha_conv2)
        await s.flush()

        aisha_reengaging_msgs = [
            (MessageRole.COACH, "Welcome back, Aisha! I'm glad to see you here. I know things got busy, but the fact that you're back shows real dedication to your recovery.\n\nYour previous goal was to do lower back exercises daily for 20 minutes. Would you like to pick up where you left off, or would you prefer to adjust your goal?", _ago(days=2)),
            (MessageRole.PATIENT, "Hi! Yeah, life got crazy for a couple weeks. I want to keep the same goal but maybe ease back in. I did some bridges and cat-cow yesterday and today.", _ago(days=1)),
            (MessageRole.COACH, "That's a perfect way to ease back in, Aisha! Starting with Bridges and Cat-Cow is smart — they're foundational exercises that help warm up your whole core and spine.\n\nYou've already got a 2-day streak going! I'll keep your original goal active. As you feel ready, you can gradually add the Bird-Dog and Dead Bugs back into your routine.\n\nYou're doing great — every session counts!", _ago(days=1, minutes=-10)),
        ]
        for role, content, ts in aisha_reengaging_msgs:
            s.add(Message(
                conversation_id=aisha_conv2.id,
                role=role,
                content=content,
                safety_status=SafetyStatus.PASSED,
                created_at=ts,
            ))

        # Aisha's schedule events
        for event_type, offset_days, status in [
            (EventType.DAY_2, 2, ScheduleStatus.SENT),
            (EventType.DAY_5, 5, ScheduleStatus.SENT),
            (EventType.DAY_7, 7, ScheduleStatus.SENT),
        ]:
            s.add(ScheduleEvent(
                patient_id=aisha.id,
                event_type=event_type,
                scheduled_at=_ago(days=32 - offset_days),
                executed_at=_ago(days=32 - offset_days),
                message=f"{event_type.value} check-in for Aisha",
                status=status,
            ))

        await s.commit()
        print("Seed complete! Created 5 patients:")
        print("  1. Sarah Chen     — ACTIVE     (knee rehab, 85% adherence)")
        print("  2. Marcus Johnson — ONBOARDING (just started, unconfirmed goal)")
        print("  3. Emily Rodriguez— DORMANT    (3 unanswered, HIGH alert)")
        print("  4. James Wilson   — PENDING    (no consent)")
        print("  5. Aisha Patel    — RE_ENGAGING(returning after gap)")


if __name__ == "__main__":
    asyncio.run(seed())
