"""Exercise bytes, multipart ordering and failures without keys or paid requests."""

import base64
import io
import json
import wave
from collections.abc import Callable

import httpx
import pytest

from exoscope.voice import service
from exoscope.voice.models import ReplyAudio
from tests.test_voice_support import install_transport, upload, wav


def test_transcribe_posts_actual_bytes_last_and_returns_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        assert request.method == "POST"
        assert request.headers["authorization"] == "Bearer test-server-key"
        assert request.headers["content-type"].startswith("multipart/form-data; boundary=")
        assert request.extensions["timeout"] == {
            "connect": 5.0,
            "read": 30.0,
            "write": 30.0,
            "pool": 30.0,
        }
        body = request.read()
        fields = [
            body.index(f'name="{name}"'.encode())
            for name in ("model", "languages[]", "keywords[]", "file")
        ]
        assert fields == sorted(fields)
        assert b'name="model"\r\n\r\ngpt-transcribe\r\n' in body
        assert b'name="languages[]"\r\n\r\nen\r\n' in body
        assert b'name="keywords[]"\r\n\r\nTRAPPIST-1\r\n' in body
        assert b'filename="recording.wav"\r\nContent-Type: audio/wav\r\n\r\n' in body
        assert wav() in body
        return httpx.Response(200, json={"text": " Open TRAPPIST-1. "})

    install_transport(monkeypatch, handle)
    assert service.transcribe(upload()) == "Open TRAPPIST-1."
    assert calls == ["https://api.openai.com/v1/audio/transcriptions"]


@pytest.mark.parametrize("streamed", [False, True])
def test_synthesize_posts_finding_and_returns_decodable_finite_wav(
    monkeypatch: pytest.MonkeyPatch, streamed: bool
) -> None:
    calls: list[str] = []
    audio = bytearray(wav())
    if streamed:
        audio[4:8] = (0x80000023).to_bytes(4, "little")
        audio[40:44] = (0x7FFFFFFF).to_bytes(4, "little")

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        assert request.headers["authorization"] == "Bearer test-server-key"
        assert json.loads(request.content) == {
            "model": "gpt-4o-mini-tts",
            "voice": "coral",
            "input": "TRAPPIST-1 e is selected.",
            "response_format": "wav",
            "instructions": "Speak clearly and calmly, like a science teacher.",
        }
        return httpx.Response(
            200, content=bytes(audio), headers={"content-type": "audio/wav; rate=24000"}
        )

    install_transport(monkeypatch, handle)
    reply = service.synthesize("  TRAPPIST-1 e is selected.  ")
    assert isinstance(reply, ReplyAudio)
    assert reply.mime_type == "audio/wav"
    decoded = base64.b64decode(reply.data_base64, validate=True)
    assert decoded == wav()
    with wave.open(io.BytesIO(decoded), "rb") as playback:
        assert playback.getparams()[:4] == (1, 2, 24000, 2400)
        assert playback.readframes(playback.getnframes()) == b"\x00\x10" * 2400
    assert calls == ["https://api.openai.com/v1/audio/speech"]


def test_long_reply_only_speaks_short_finding(monkeypatch: pytest.MonkeyPatch) -> None:
    long_reply = "A finding with units and provenance. " * 100
    spoken: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        spoken.append(json.loads(request.content)["input"])
        return httpx.Response(200, content=wav(), headers={"content-type": "audio/wav"})

    install_transport(monkeypatch, handle)
    service.synthesize(long_reply)
    assert spoken == ["A finding with units and provenance. A finding with units and provenance."]


@pytest.mark.parametrize(
    ("reply", "finding"),
    [
        (
            "**TRAPPIST-1 b** gets the most light [1]. See https://example.org/x for more. Extra.",
            "TRAPPIST-1 b gets the most light. See for more.",
        ),
        ("No liquid water is confirmed ([[1]](https://a.org)). Sources:\n- a\n- b", None),
        ("word " * 200, None),
    ],
)
def test_spoken_finding_drops_markup_links_and_citations(reply: str, finding: str | None) -> None:
    spoken = service._short_finding(reply)  # pyright: ignore[reportPrivateUsage]
    assert len(spoken) <= service.MAX_SPEECH_CHARACTERS
    assert "http" not in spoken and "*" not in spoken and "[" not in spoken
    if finding is not None:
        assert spoken == finding
    if reply.startswith("word"):
        assert spoken.endswith("…")


@pytest.mark.parametrize(
    "operation", [lambda: service.transcribe(upload()), lambda: service.synthesize("Hi")]
)
@pytest.mark.parametrize("status", [302, 401, 403, 429, 500, 504])
def test_provider_failures_are_safe_and_not_retried_or_redirected(
    monkeypatch: pytest.MonkeyPatch, operation: Callable[[], object], status: int
) -> None:
    calls = 0

    def handle(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            status,
            headers={"location": "https://evil.invalid/"},
            json={"error": "test-server-key provider-private-detail"},
        )

    install_transport(monkeypatch, handle)
    with pytest.raises(service.VoiceError) as caught:
        operation()
    assert caught.value.status_code == 502
    assert "test-server-key" not in str(caught.value)
    assert "provider-private-detail" not in str(caught.value)
    assert calls == 1


@pytest.mark.parametrize(
    "operation", [lambda: service.transcribe(upload()), lambda: service.synthesize("Hi")]
)
@pytest.mark.parametrize(
    "failure", [httpx.ReadTimeout, httpx.ConnectError, httpx.RemoteProtocolError]
)
def test_network_errors_are_safe_and_not_retried(
    monkeypatch: pytest.MonkeyPatch,
    operation: Callable[[], object],
    failure: type[httpx.RequestError],
) -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise failure("test-server-key upstream-detail", request=request)

    install_transport(monkeypatch, handle)
    with pytest.raises(service.VoiceError) as caught:
        operation()
    assert caught.value.status_code == (504 if failure is httpx.ReadTimeout else 502)
    assert "test-server-key" not in str(caught.value)
    assert "upstream-detail" not in str(caught.value)
    assert caught.value.__suppress_context__
    assert calls == 1


@pytest.mark.parametrize(
    "operation", [lambda: service.transcribe(upload()), lambda: service.synthesize("Hi")]
)
@pytest.mark.parametrize("key", [None, "", "  "])
def test_missing_key_is_honest_and_makes_no_request(
    monkeypatch: pytest.MonkeyPatch, operation: Callable[[], object], key: str | None
) -> None:
    def never(_request: httpx.Request) -> httpx.Response:
        pytest.fail("Missing-key call reached transport")

    install_transport(monkeypatch, never)
    if key is None:
        monkeypatch.delenv("OPENAI_API_KEY")
    else:
        monkeypatch.setenv("OPENAI_API_KEY", key)
    with pytest.raises(service.VoiceError, match="OPENAI_API_KEY") as caught:
        operation()
    assert caught.value.status_code == 503


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": "  "}, {"text": 5}, [], None])
def test_empty_or_malformed_transcript_fails(
    monkeypatch: pytest.MonkeyPatch, payload: object
) -> None:
    install_transport(monkeypatch, lambda _request: httpx.Response(200, json=payload))
    with pytest.raises(service.VoiceError):
        service.transcribe(upload())


def test_non_json_transcript_fails_safely(monkeypatch: pytest.MonkeyPatch) -> None:
    install_transport(monkeypatch, lambda _request: httpx.Response(200, content=b"test-server-key"))
    with pytest.raises(service.VoiceError, match="invalid transcript") as caught:
        service.transcribe(upload())
    assert "test-server-key" not in str(caught.value)
