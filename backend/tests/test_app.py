import asyncio
from typing import Any

import httpx

from exoscope.app import app


def request(method: str, path: str, json: dict[str, Any] | None = None) -> httpx.Response:
    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json)

    return asyncio.run(run())


def test_health() -> None:
    assert request("GET", "/health").json() == {"status": "ok"}


def test_turn_returns_validated_empty_response() -> None:
    body = request("POST", "/turn", {"text": "Open TRAPPIST-1"}).json()
    assert body == {"transcript": "Open TRAPPIST-1", "reply_text": "", "ui_commands": []}


def test_turn_rejects_empty_text() -> None:
    assert request("POST", "/turn", {"text": ""}).status_code == 422
