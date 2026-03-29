"""Text-to-speech endpoint using Deepgram."""

import os
import re
import logging

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"


def _strip_for_speech(text: str) -> str:
    """Remove emojis, markdown, and other non-speech characters."""
    # Remove emoji unicode ranges
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U0001f926-\U0001f937"
        "\U00010000-\U0010ffff"
        "\u2640-\u2642"
        "\u2600-\u2B55"
        "\u200d"
        "\u23cf"
        "\u23e9"
        "\u231a"
        "\ufe0f"
        "\u3030"
        "]+",
        flags=re.UNICODE,
    )
    text = emoji_pattern.sub("", text)
    # Remove markdown
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"__(.*?)__", r"\1", text)
    text = re.sub(r"[#*_`]", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # [link](url) -> link
    text = re.sub(r"<[^>]+>", "", text)  # HTML tags
    text = re.sub(r"\s+", " ", text).strip()
    return text


class TTSRequest(BaseModel):
    text: str
    voice: str = "aura-2-athena-en"  # Deepgram female voice


@router.post("/speak")
async def text_to_speech(req: TTSRequest) -> Response:
    """Convert text to speech using Deepgram TTS."""
    api_key = os.environ.get("DEEPGRAM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Deepgram API key not configured")

    cleaned = _strip_for_speech(req.text)
    if not cleaned:
        raise HTTPException(status_code=400, detail="No speakable text after filtering")
    # Deepgram has a 2000 char limit — truncate at last sentence boundary
    if len(cleaned) > 1900:
        cut = cleaned[:1900].rfind('. ')
        cleaned = cleaned[:cut + 1] if cut > 0 else cleaned[:1900]

    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json",
    }

    params = {
        "model": req.voice,
        "encoding": "mp3",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                DEEPGRAM_TTS_URL,
                headers=headers,
                params=params,
                json={"text": cleaned},
            )
            response.raise_for_status()
            return Response(
                content=response.content,
                media_type="audio/mpeg",
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except httpx.HTTPStatusError as e:
        logger.error("Deepgram TTS error: %s %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=502, detail="TTS service error")
    except Exception as e:
        logger.error("TTS failed: %s", e)
        raise HTTPException(status_code=502, detail="TTS service unavailable")
