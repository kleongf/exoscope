"""Mock the HTTP boundary; never spend keys/credits in normal verification."""

import io
import json
import wave
from pathlib import Path

import httpx
import pytest

from exoscope.service_smoke.voice import (
    PHRASE,
    STT_MODEL,
    check_voice,
    finalise_wav,
    round_trip,
    wav_duration,
)


def wav(*, silent: bool = False) -> bytes:
    data = io.BytesIO()
    with wave.open(data, "wb") as audio:
        audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        audio.writeframes((b"\x00\x00" if silent else b"\x00\x10") * 2400)
    return data.getvalue()


@pytest.mark.parametrize("external", [False, True])
def test_voice_validates_transcript_then_synthesizes_it(tmp_path: Path, external: bool) -> None:
    paths: list[str] = []
    transcript = "open the planet view"

    def handle(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        assert request.headers["authorization"] == "Bearer test-only"
        if request.url.path == "/v1/tts":
            payload = json.loads(request.content)
            assert payload["text"] == (PHRASE if len(paths) == 1 and not external else transcript)
            assert payload["output_format"] == {"codec": "wav", "sample_rate": 24000}
            assert payload["voice_id"] == "eve"
            return httpx.Response(200, content=wav(), headers={"content-type": "audio/wav"})
        assert request.url.path == "/v1/stt"
        body = request.read()
        assert STT_MODEL.encode() in body and wav() in body
        assert body.index(b'name="model"') < body.index(b'name="file"')
        return httpx.Response(200, json={"text": transcript})

    clip = tmp_path / "external.wav" if external else None
    if clip:
        clip.write_bytes(wav())
    with httpx.Client(
        base_url="https://api.x.ai",
        headers={"Authorization": "Bearer test-only"},
        transport=httpx.MockTransport(handle),
    ) as client:
        detail = round_trip(client, tmp_path / "out", clip, PHRASE)
    assert paths == (["/v1/stt", "/v1/tts"] if external else ["/v1/tts", "/v1/stt", "/v1/tts"])
    assert "decoded 0.10s PCM WAV" in detail
    assert wav_duration((tmp_path / "out/voice-reply.wav").read_bytes()) == 0.1


@pytest.mark.parametrize("payload", [{"text": "wrong words"}, {"text": ""}, {"text": 123}, {}])
def test_bad_transcript_fails_without_tts_or_stale_reply(tmp_path: Path, payload: object) -> None:
    clip = tmp_path / "clip.wav"
    clip.write_bytes(wav())
    (tmp_path / "voice-reply.wav").write_bytes(b"old success")

    def handle(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/stt"
        return httpx.Response(200, json=payload)

    with (
        httpx.Client(base_url="https://api.x.ai", transport=httpx.MockTransport(handle)) as client,
        pytest.raises(ValueError, match="STT"),
    ):
        round_trip(client, tmp_path, clip, PHRASE)
    assert not (tmp_path / "voice-reply.wav").exists()


@pytest.mark.parametrize("stage", ["seed", "stt", "reply"])
def test_real_http_error_propagates_from_every_stage(tmp_path: Path, stage: str) -> None:
    calls = 0
    fail_at = {"seed": 1, "stt": 2, "reply": 3}[stage]

    def handle(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == fail_at:
            return httpx.Response(403, json={"error": "account not enabled"})
        if calls == 2:
            return httpx.Response(200, json={"text": PHRASE})
        return httpx.Response(200, content=wav(), headers={"content-type": "audio/wav"})

    with (
        httpx.Client(base_url="https://api.x.ai", transport=httpx.MockTransport(handle)) as client,
        pytest.raises(ValueError, match=r"HTTP 403.*account not enabled"),
    ):
        round_trip(client, tmp_path, None, PHRASE)
    assert calls == fail_at
    assert not (tmp_path / "voice-reply.wav").exists()


@pytest.mark.parametrize("data", [b"", b"not audio", wav(silent=True), wav()[:-10]])
def test_invalid_empty_silent_and_truncated_audio_fail(data: bytes) -> None:
    with pytest.raises((ValueError, wave.Error, EOFError)):
        wav_duration(data)


def test_http_200_json_is_not_playable_audio(tmp_path: Path) -> None:
    def handle(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": "not audio"})

    with (
        httpx.Client(base_url="https://api.x.ai", transport=httpx.MockTransport(handle)) as client,
        pytest.raises(ValueError, match=r"non-WAV.*not audio"),
    ):
        round_trip(client, tmp_path, None, PHRASE)


def test_streaming_wav_sentinel_is_finalised_from_received_samples() -> None:
    streamed = bytearray(wav())
    streamed[4:8] = (0x80000023).to_bytes(4, "little")
    streamed[40:44] = (0x7FFFFFFF).to_bytes(4, "little")
    assert finalise_wav(bytes(streamed)) == wav()


def test_finite_wav_truncation_is_never_repaired() -> None:
    with pytest.raises(ValueError, match="truncated"):
        finalise_wav(wav()[:-10])


def test_partial_pcm_frame_in_streaming_wav_fails() -> None:
    streamed = bytearray(wav()[:-1])
    streamed[4:8] = (0x80000023).to_bytes(4, "little")
    streamed[40:44] = (0x7FFFFFFF).to_bytes(4, "little")
    with pytest.raises(ValueError, match="incomplete PCM"):
        finalise_wav(bytes(streamed))


def test_missing_xai_key_fails(tmp_path: Path) -> None:
    (tmp_path / "voice-reply.wav").write_bytes(b"stale")
    with pytest.raises(ValueError, match="Missing XAI_API_KEY"):
        check_voice("", tmp_path, None, PHRASE)
    assert not (tmp_path / "voice-reply.wav").exists()
