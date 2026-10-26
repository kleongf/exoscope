"""Offline audio fixtures and a real httpx client with only its transport replaced."""

import base64
import io
import wave
from collections.abc import Callable

import httpx
import pytest

from exoscope.voice.models import AudioInput

type Handler = Callable[[httpx.Request], httpx.Response]


def wav(*, silent: bool = False) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        audio.writeframes((b"\x00\x00" if silent else b"\x00\x10") * 2400)
    return output.getvalue()


def upload(data: bytes | None = None, mime: str = "audio/wav") -> AudioInput:
    return AudioInput(
        data_base64=base64.b64encode(wav() if data is None else data).decode("ascii"),
        mime_type=mime,
    )


def install_transport(monkeypatch: pytest.MonkeyPatch, handler: Handler) -> None:
    def transport(*, retries: int) -> httpx.MockTransport:
        assert retries == 0
        return httpx.MockTransport(handler)

    monkeypatch.setenv("OPENAI_API_KEY", "test-server-key")
    monkeypatch.setattr(httpx, "HTTPTransport", transport)
