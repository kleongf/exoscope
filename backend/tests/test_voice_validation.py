"""Untrusted recordings and provider audio never become unchecked playback files."""

import base64

import httpx
import pytest

from exoscope.voice import audio, service
from exoscope.voice.models import AudioInput
from tests.test_voice_support import install_transport, upload, wav


@pytest.mark.parametrize(
    ("data", "mime", "extension", "content_type"),
    [
        (b"\x1aE\xdf\xa3\x84webm", "audio/webm;codecs=opus", "webm", "audio/webm"),
        (b"\x1aE\xdf\xa3\x84webm", ' Audio/WebM ; codecs="opus" ', "webm", "audio/webm"),
        (b"\x1aE\xdf\xa3\x84webm", "audio/webm", "webm", "audio/webm"),
        (b"OggS\x00\x00OpusHead", "audio/ogg; codecs=opus", "ogg", "audio/ogg"),
        (b"OggS\x00\x00OpusHead", "audio/ogg", "ogg", "audio/ogg"),
        (b"\x00\x00\x00\x18ftypisom", "audio/mp4", "mp4", "audio/mp4"),
        (b"\x00\x00\x00\x18ftypisom", 'audio/mp4;codecs="mp4a.40.2"', "mp4", "audio/mp4"),
        (wav(), "audio/wav", "wav", "audio/wav"),
        (wav(), "audio/x-wav", "wav", "audio/wav"),
    ],
)
def test_browser_mime_parameters_match_uploaded_bytes_and_filename(
    monkeypatch: pytest.MonkeyPatch, data: bytes, mime: str, extension: str, content_type: str
) -> None:
    # Container header fixtures check the upload envelope, not codec decoding.
    def handle(request: httpx.Request) -> httpx.Response:
        body = request.read()
        assert data in body
        assert f'filename="recording.{extension}"'.encode() in body
        assert f"Content-Type: {content_type}\r\n".encode() in body
        return httpx.Response(200, json={"text": "Open TRAPPIST-1"})

    install_transport(monkeypatch, handle)
    assert service.transcribe(upload(data, mime)) == "Open TRAPPIST-1"


@pytest.mark.parametrize(
    "data", ["!", "data:audio/wav;base64,UklGRg==", "UklG Rg==", "é", "UklGRg"]
)
def test_invalid_base64_is_rejected_before_network(
    monkeypatch: pytest.MonkeyPatch, data: str
) -> None:
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    with pytest.raises(service.VoiceError, match="base64") as caught:
        service.transcribe(AudioInput(data_base64=data, mime_type="audio/wav"))
    assert caught.value.status_code == 400


@pytest.mark.parametrize(
    "mime",
    [
        "",
        "text/plain",
        "audio/mpeg",
        "audio/webm;codecs=vorbis",
        "audio/ogg;codecs=vorbis",
        "audio/webm;codecs=opus;anything=x",
        'audio/webm;codecs="opus',
        "audio/wav\r\nX-Header: x",
    ],
)
def test_unsupported_mime_never_reaches_network(monkeypatch: pytest.MonkeyPatch, mime: str) -> None:
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    with pytest.raises(service.VoiceError) as caught:
        service.transcribe(upload(mime=mime))
    assert caught.value.status_code == 400


@pytest.mark.parametrize("data", [b"", b'{"error":"not audio"}', b"plain text", b"RIFFnot-WAVE"])
def test_empty_and_mismatched_container_rejected_before_network(data: bytes) -> None:
    with pytest.raises(service.VoiceError, match="audio format"):
        service.transcribe(upload(data))


def test_encoded_limit_prevents_base64_allocation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(audio, "MAX_AUDIO_BYTES", 12)

    def never(_data: str, *, validate: bool) -> bytes:
        pytest.fail("Oversized base64 was decoded")

    monkeypatch.setattr(audio.base64, "b64decode", never)
    with pytest.raises(service.VoiceError) as caught:
        service.transcribe(AudioInput(data_base64="A" * 20, mime_type="audio/wav"))
    assert caught.value.status_code == 413


def test_decoded_limit_handles_base64_rounding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(audio, "MAX_AUDIO_BYTES", 10)
    with pytest.raises(service.VoiceError) as caught:
        service.transcribe(upload(b"RIFFxxxxWAVE"))  # 12 bytes, same encoded size as 10.
    assert caught.value.status_code == 413


def test_exact_upload_limit_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(audio, "MAX_AUDIO_BYTES", len(wav()))
    install_transport(monkeypatch, lambda _request: httpx.Response(200, json={"text": "Hi"}))
    assert service.transcribe(upload()) == "Hi"


@pytest.mark.parametrize("text", ["", "  \n\t"])
def test_empty_finding_rejected_before_network(text: str) -> None:
    with pytest.raises(service.VoiceError, match="no finding") as caught:
        service.synthesize(text)
    assert caught.value.status_code == 400


@pytest.mark.parametrize(
    ("body", "content_type"),
    [
        (b'{"error":"test-server-key"}', "application/json"),
        (b'{"error":"test-server-key"}', "audio/wav"),
        (wav(), "audio/mpeg"),
        (wav(), ""),
        (b"", "audio/wav"),
        (wav()[:-10], "audio/wav"),
        (wav(silent=True), "audio/wav"),
    ],
)
def test_tts_rejects_json_wrong_content_type_empty_truncated_or_silent_audio(
    monkeypatch: pytest.MonkeyPatch, body: bytes, content_type: str
) -> None:
    install_transport(
        monkeypatch,
        lambda _request: httpx.Response(200, content=body, headers={"content-type": content_type}),
    )
    with pytest.raises(service.VoiceError) as caught:
        service.synthesize("A finding")
    assert "test-server-key" not in str(caught.value)


def test_incomplete_streaming_pcm_frame_is_not_repaired(monkeypatch: pytest.MonkeyPatch) -> None:
    data = bytearray(wav()[:-1])
    data[4:8] = (0x80000023).to_bytes(4, "little")
    data[40:44] = (0x7FFFFFFF).to_bytes(4, "little")
    install_transport(
        monkeypatch,
        lambda _request: httpx.Response(
            200, content=bytes(data), headers={"content-type": "audio/wav"}
        ),
    )
    with pytest.raises(service.VoiceError, match="incomplete audio"):
        service.synthesize("A finding")


def test_oversized_tts_body_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(audio, "MAX_REPLY_BYTES", len(wav()) - 1)
    install_transport(
        monkeypatch,
        lambda _request: httpx.Response(200, content=wav(), headers={"content-type": "audio/wav"}),
    )
    with pytest.raises(service.VoiceError, match="invalid or incomplete audio"):
        service.synthesize("A finding")


def test_unknown_streaming_riff_size_is_not_repaired() -> None:
    data = bytearray(wav())
    data[4:8] = (0xFFFFFFFF).to_bytes(4, "little")
    data[40:44] = (0x7FFFFFFF).to_bytes(4, "little")
    with pytest.raises(ValueError, match="Truncated"):
        audio.finalise_wav(bytes(data))


def test_reply_is_plain_base64_without_data_url(monkeypatch: pytest.MonkeyPatch) -> None:
    install_transport(
        monkeypatch,
        lambda _request: httpx.Response(
            200, content=wav(), headers={"content-type": "audio/x-wav"}
        ),
    )
    reply = service.synthesize("Hi")
    assert base64.b64decode(reply.data_base64, validate=True) == wav()
    assert reply.model_dump() == {"data_base64": reply.data_base64, "mime_type": "audio/wav"}
