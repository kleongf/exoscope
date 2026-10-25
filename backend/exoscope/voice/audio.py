"""Bounded upload decoding and finite PCM WAV playback files."""

import base64
import io
import re
import wave

from exoscope.voice.errors import VoiceError
from exoscope.voice.models import AudioInput

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_REPLY_BYTES = 20 * 1024 * 1024
_EXTENSIONS = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/wav": "wav"}
_ALIASES = {"audio/x-wav": "audio/wav", "audio/wave": "audio/wav"}
_CODECS = {
    "audio/webm": {"opus"},
    "audio/ogg": {"opus"},
    "audio/mp4": {"mp4a.40.2", "mp4a.40.5", "mp4a.40.29", "opus"},
}


def _mime(value: str) -> str:
    parts = [part.strip().lower() for part in value.split(";")]
    mime = _ALIASES.get(parts[0], parts[0])
    if mime not in _EXTENSIONS or len(parts) > 2:
        raise VoiceError("Use a WebM/Opus, Ogg/Opus, MP4, or WAV recording.", status_code=400)
    if len(parts) == 2:
        match = re.fullmatch(r'codecs\s*=\s*(?:"([^"]+)"|([^"\s]+))', parts[1])
        if not match or (match[1] or match[2]) not in _CODECS.get(mime, set()):
            raise VoiceError("The recording's audio codec is not supported.", status_code=400)
    return mime


def _matches_container(data: bytes, mime: str) -> bool:
    if mime == "audio/wav":
        return len(data) >= 44 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if mime == "audio/webm":
        return data.startswith(b"\x1aE\xdf\xa3") and b"webm" in data[:4096]
    if mime == "audio/ogg":
        return data.startswith(b"OggS\x00") and b"OpusHead" in data[:4096]
    return len(data) >= 12 and data[4:8] == b"ftyp"


def decode_upload(audio: AudioInput) -> tuple[bytes, str, str]:
    """Check size before allocation, strict base64, MIME parameters and container."""
    mime = _mime(audio.mime_type)
    if len(audio.data_base64) > 4 * ((MAX_AUDIO_BYTES + 2) // 3):
        raise VoiceError("The recording exceeds the 10 MiB upload limit.", status_code=413)
    try:
        data = base64.b64decode(audio.data_base64, validate=True)
    except ValueError:
        raise VoiceError("The recording is not valid base64 audio.", status_code=400) from None
    if len(data) > MAX_AUDIO_BYTES:
        raise VoiceError("The recording exceeds the 10 MiB upload limit.", status_code=413)
    if not data or not _matches_container(data, mime):
        raise VoiceError("The recording does not match its audio format.", status_code=400)
    return data, mime, f"recording.{_EXTENSIONS[mime]}"


def finalise_wav(data: bytes) -> bytes:
    """Copy the verified smoke behavior without depending on the smoke package.

    Only xAI's observed pair of streaming size sentinels is repaired. Finite
    truncated files, incomplete PCM frames, and silence are never made playable.
    """
    if not data or len(data) > MAX_REPLY_BYTES or data[:4] != b"RIFF":
        raise ValueError("Invalid WAV body")
    with wave.open(io.BytesIO(data), "rb") as audio:
        params = audio.getparams()
        alignment = audio.getsampwidth() * audio.getnchannels()
        frames = audio.readframes(audio.getnframes())
        sentinel = audio.getnframes() == 0x7FFFFFFF // alignment
        expected = audio.getnframes() * alignment
    if (params.nchannels, params.sampwidth, params.framerate) != (1, 2, 24000):
        raise ValueError("Expected mono 24 kHz 16-bit PCM WAV")
    if not frames or len(frames) % alignment or not any(frames):
        raise ValueError("Empty, silent or incomplete PCM WAV")
    if sentinel and int.from_bytes(data[4:8], "little") == 0x80000023:
        final = io.BytesIO()
        with wave.open(final, "wb") as output:
            output.setparams(params)
            output.writeframes(frames)
        return final.getvalue()
    if len(frames) != expected or int.from_bytes(data[4:8], "little") != len(data) - 8:
        raise ValueError("Truncated WAV")
    return data
