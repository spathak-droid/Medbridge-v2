"""Email notification service using Resend API.

Sends transactional emails for reminders, check-ins, and weekly digests.
Falls back to logging when RESEND_API_KEY is not configured.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_EMAIL", "MedBridge Coach <coach@medbridge.app>")
RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Send an email via Resend API.

    Returns True if sent successfully, False otherwise.
    Falls back to logging when API key is not configured.
    """
    if not RESEND_API_KEY:
        logger.info(
            "Email (no API key, logged only): to=%s subject=%s",
            to, subject,
        )
        return False

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10.0,
            )
        if resp.status_code in (200, 201):
            logger.info("Email sent to %s: %s", to, subject)
            return True
        else:
            logger.warning(
                "Resend API error %d: %s", resp.status_code, resp.text[:200]
            )
            return False
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def build_reminder_email(
    patient_name: str,
    reminder_message: str,
) -> dict:
    """Build HTML email for a reminder notification."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0; font-size: 18px;">MedBridge Coach</h2>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Hi {patient_name},
      </p>
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #065f46; font-size: 14px; line-height: 1.6; margin: 0;">
          {reminder_message}
        </p>
      </div>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        — Your AI Rehabilitation Coach
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px;">
        This is an automated message from MedBridge. Do not reply to this email.
      </p>
    </div>
    """
    return {
        "subject": "Reminder from your MedBridge Coach",
        "html": html,
        "text": f"Hi {patient_name},\n\n{reminder_message}\n\n— Your AI Rehabilitation Coach",
    }


def build_checkin_email(
    patient_name: str,
    checkin_message: str,
    day_label: str,
) -> dict:
    """Build HTML email for a scheduled check-in."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0; font-size: 18px;">MedBridge Coach — {day_label}</h2>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Hi {patient_name},
      </p>
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #1e3a5f; font-size: 14px; line-height: 1.6; margin: 0;">
          {checkin_message}
        </p>
      </div>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        — Your AI Rehabilitation Coach
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px;">
        This is an automated message from MedBridge. Do not reply to this email.
      </p>
    </div>
    """
    return {
        "subject": f"Your {day_label} Check-In — MedBridge",
        "html": html,
        "text": f"Hi {patient_name},\n\n{checkin_message}\n\n— Your AI Rehabilitation Coach",
    }


def build_digest_email(
    patient_name: str,
    digest_message: str,
) -> dict:
    """Build HTML email for a weekly digest."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Your Weekly Progress</h2>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Hi {patient_name},
      </p>
      <div style="background: #faf5ff; border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #3b0764; font-size: 14px; line-height: 1.6; margin: 0;">
          {digest_message}
        </p>
      </div>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        — Your AI Rehabilitation Coach
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px;">
        This is an automated message from MedBridge. Do not reply to this email.
      </p>
    </div>
    """
    return {
        "subject": "Your Weekly Progress — MedBridge",
        "html": html,
        "text": f"Hi {patient_name},\n\n{digest_message}\n\n— Your AI Rehabilitation Coach",
    }
