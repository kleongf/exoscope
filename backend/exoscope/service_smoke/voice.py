"""xAI's documented REST STT/TTS APIs, with decoded PCM WAV evidence."""

import io
import re
import wave
from pathlib import Path

import httpx

PHRASE = "Open the planet view."
STT_MODEL = "grok-voice-transcribe-2.0"


def finalise_wav(data: bytes) -> bytes:
    """Finalise only known streaming size sentinels after the HTTP body completes.

    Observed xAI WAV: RIFF size 0x80000023, data size 0x7fffffff. Keep strict
    truncation checks for ordinary finite-size WAVs; never invent missing samples.
    """
    with wave.open(io.BytesIO(data), "rb") as audio:
        params = audio.getparams()
        alignment = audio.getsampwidth() * audio.getnchannels()
        frames = audio.readframes(audio.getnframes())
        sentinel = audio.getnframes() == 0x7FFFFFFF // alignment
    if sentinel and int.from_bytes(data[4:8], "little") == 0x80000023:
        if not frames or len(frames) % alignment:
            raise ValueError("Streaming WAV has empty or incomplete PCM frames")
        final = io.BytesIO()
        with wave.open(final, "wb") as output:
            output.setparams(params)
            output.writeframes(frames)
        data = final.getvalue()
    wav_duration(data)
    return data


def wav_duration(data: bytes) -> float:
    with wave.open(io.BytesIO(data), "rb") as audio:
        frames = audio.readframes(audio.getnframes())
        width = audio.getsampwidth()
        expected = audio.getnframes() * audio.getnchannels() * width
        if not expected or len(frames) != expected:
            raise ValueError("WAV is empty or truncated")
        if not any(byte != (128 if width == 1 else 0) for byte in frames):
            raise ValueError("WAV contains only silence")
        return audio.getnframes() / audio.getframerate()


def checked(response: httpx.Response) -> httpx.Response:
    if not response.is_success:
        raise ValueError(
            f"{response.request.url.path}: HTTP {response.status_code}: {response.text}"
        )
    return response


def tts(client: httpx.Client, text: str) -> bytes:
    response = checked(
        client.post(
            "/v1/tts",
            json={
                "text": text,
                "voice_id": "eve",
                "language": "en",
                "output_format": {"codec": "wav", "sample_rate": 24000},
            },
        )
    )
    if response.headers.get("content-type", "").split(";")[0] not in {
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
    }:
        raise ValueError(f"TTS returned non-WAV content: {response.text}")
    return finalise_wav(response.content)


def round_trip(client: httpx.Client, output: Path, audio: Path | None, expected: str) -> str:
    output.mkdir(parents=True, exist_ok=True)
    reply_path = output / "voice-reply.wav"
    reply_path.unlink(missing_ok=True)  # A failed rerun must not leave an old PASS artifact.
    if audio is None:
        seed = output / "voice-input.wav"
        seed.unlink(missing_ok=True)
        seed.write_bytes(tts(client, expected))
        audio = seed
    with audio.open("rb") as clip:
        response = checked(
            client.post(
                "/v1/stt",
                data={"model": STT_MODEL, "language": "en", "format": "true"},
                files={"file": (audio.name, clip, "application/octet-stream")},
            )
        )
    transcript = response.json().get("text")
    if not isinstance(transcript, str) or not transcript.strip():
        raise ValueError(f"STT returned no nonempty text: {response.text}")
    if re.findall(r"\w+", transcript.casefold()) != re.findall(r"\w+", expected.casefold()):
        raise ValueError(f"STT transcript mismatch: expected={expected!r}, observed={transcript!r}")
    reply = tts(client, transcript)
    duration = wav_duration(reply)
    reply_path.write_bytes(reply)
    return (
        f"{STT_MODEL}: transcript={transcript!r}; TTS eve decoded {duration:.2f}s PCM WAV "
        f"saved to {reply_path} (playback file; no listening claim)"
    )


def check_voice(key: str, output: Path, audio: Path | None, expected: str) -> str:
    if not key:
        (output / "voice-reply.wav").unlink(missing_ok=True)
        raise ValueError("Missing XAI_API_KEY; live voice check unverified")
    with httpx.Client(
        base_url="https://api.x.ai",
        headers={"Authorization": f"Bearer {key}"},
        timeout=60.0,
        follow_redirects=False,
    ) as client:
        return round_trip(client, output, audio, expected)
