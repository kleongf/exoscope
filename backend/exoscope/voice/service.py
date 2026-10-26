"""Server-only, synchronous OpenAI speech adapter for the turn handler."""

import base64
import re
import wave
from collections.abc import Generator
from contextlib import contextmanager
from typing import cast

import httpx

from exoscope.openai_api import BASE_URL, STT_MODEL, TTS_MODEL, TTS_VOICE, openai_key
from exoscope.voice.audio import decode_upload, finalise_wav
from exoscope.voice.errors import VoiceError
from exoscope.voice.models import AudioInput, ReplyAudio

__all__ = ["VoiceError", "synthesize", "transcribe"]

MAX_SPEECH_CHARACTERS = 280
SPOKEN_SENTENCES = 2
# Hints, not required output: names the student is likely to say.
KEYWORDS = ["TRAPPIST-1", "TOI-700", "exoplanet", "insolation", "semi-major axis"]
REQUEST_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


@contextmanager
def _client() -> Generator[httpx.Client]:
    # Read at call time so the app can explicitly load its chosen dotenv first.
    key = openai_key()
    if not key:
        raise VoiceError("Voice is unavailable: OPENAI_API_KEY is not configured.", status_code=503)
    try:
        with httpx.Client(
            base_url=BASE_URL,
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
                "/v1/audio/transcriptions",
                data={"model": STT_MODEL, "languages[]": ["en"], "keywords[]": KEYWORDS},
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


_MARKUP = re.compile(r"[*_#`>]+|\[\d+\]|\[\[\d+\]\]\([^)]*\)|https?://\S+|\([^)]*https?://[^)]*\)")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def _short_finding(text: str) -> str:
    """The spoken finding: the first sentences of the reply, without markup, links or citations.

    TTS time grows with the text (a 450-character reply took ~4.3 s, a two-sentence one ~1 s),
    and the full reply stays on screen, so speech only carries the headline.
    """
    text = re.sub(r"\s+([.,;:!?])", r"\1", " ".join(_MARKUP.sub("", text).split()))
    if not text:
        raise VoiceError("There is no finding to speak.", status_code=400)
    spoken = ""
    for sentence in _SENTENCE_END.split(text)[:SPOKEN_SENTENCES]:
        candidate = f"{spoken} {sentence}".strip()
        if spoken and len(candidate) > MAX_SPEECH_CHARACTERS:
            break
        spoken = candidate
    if len(spoken) <= MAX_SPEECH_CHARACTERS:
        return spoken
    prefix = spoken[: MAX_SPEECH_CHARACTERS - 1]
    return (prefix.rsplit(" ", 1)[0] or prefix) + "…"


def synthesize(text: str) -> ReplyAudio:
    """Speak the short finding; return finite, decoded-validated browser WAV audio."""
    finding = _short_finding(text)
    with _client() as client:
        response = _checked(
            client.post(
                "/v1/audio/speech",
                json={
                    "model": TTS_MODEL,
                    "voice": TTS_VOICE,
                    "input": finding,
                    "response_format": "wav",
                    "instructions": "Speak clearly and calmly, like a science teacher.",
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
