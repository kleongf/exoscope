"""Server-only, synchronous xAI speech adapter for the turn handler."""

import base64
import os
import wave
from collections.abc import Generator
from contextlib import contextmanager
from typing import cast

import httpx

from exoscope.voice.audio import decode_upload, finalise_wav
from exoscope.voice.errors import VoiceError
from exoscope.voice.models import AudioInput, ReplyAudio

__all__ = ["VoiceError", "synthesize", "transcribe"]

STT_MODEL = "grok-voice-transcribe-2.0"
MAX_SPEECH_CHARACTERS = 600
REQUEST_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


@contextmanager
def _client() -> Generator[httpx.Client]:
    # Read at call time so the app can explicitly load its chosen dotenv first.
    key = os.environ.get("XAI_API_KEY", "").strip()
    if not key:
        raise VoiceError("Voice is unavailable: XAI_API_KEY is not configured.", status_code=503)
    try:
        with httpx.Client(
            base_url="https://api.x.ai",
            headers={"Authorization": f"Bearer {key}"},
            timeout=REQUEST_TIMEOUT,
            follow_redirects=False,
            transport=httpx.HTTPTransport(retries=0),
            trust_env=False,
        ) as client:
            yield client
    except httpx.TimeoutException:
        raise VoiceError(
            "The voice service timed out. Please try typing instead.", status_code=504
        ) from None
    except httpx.HTTPError:
        raise VoiceError(
            "The voice service could not be reached. Please try typing instead."
        ) from None


def _checked(response: httpx.Response) -> httpx.Response:
    if not response.is_success:
        # Never forward provider bodies, URLs, exception strings or request headers.
        raise VoiceError("The voice service rejected the request. Please try typing instead.")
    return response


def transcribe(audio: AudioInput) -> str:
    """Transcribe a bounded browser recording, raising a safe VoiceError on failure."""
    data, mime, filename = decode_upload(audio)
    with _client() as client:
        response = _checked(
            client.post(
                "/v1/stt",
                data={"model": STT_MODEL, "language": "en", "format": "true"},
                files={"file": (filename, data, mime)},
            )
        )
    try:
        payload: object = response.json()
    except ValueError:
        raise VoiceError("The voice service returned an invalid transcript.") from None
    transcript = cast(dict[str, object], payload).get("text") if isinstance(payload, dict) else None
    if not isinstance(transcript, str) or not transcript.strip():
        raise VoiceError("No speech was recognized. Please try typing instead.")
    return transcript.strip()


def _short_finding(text: str) -> str:
    text = text.strip()
    if not text:
        raise VoiceError("There is no finding to speak.", status_code=400)
    if len(text) <= MAX_SPEECH_CHARACTERS:
        return text
    prefix = text[: MAX_SPEECH_CHARACTERS - 1]
    return (prefix.rsplit(" ", 1)[0] or prefix) + "…"


def synthesize(text: str) -> ReplyAudio:
    """Speak the short finding; return finite, decoded-validated browser WAV audio."""
    finding = _short_finding(text)
    with _client() as client:
        response = _checked(
            client.post(
                "/v1/tts",
                json={
                    "text": finding,
                    "voice_id": "eve",
                    "language": "en",
                    "output_format": {"codec": "wav", "sample_rate": 24000},
                },
            )
        )
    mime = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if mime not in {"audio/wav", "audio/x-wav", "audio/wave"}:
        raise VoiceError("The voice service returned an unsupported audio format.")
    try:
        data = finalise_wav(response.content)
    except (ValueError, wave.Error, EOFError):
        raise VoiceError("The voice service returned invalid or incomplete audio.") from None
    return ReplyAudio(data_base64=base64.b64encode(data).decode("ascii"), mime_type="audio/wav")
