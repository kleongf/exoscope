import asyncio
from pathlib import Path
from typing import Any

import httpx
import pytest

from exoscope.agent import environment, turn
from exoscope.agent.loop import AgentResult
from exoscope.app import app


def request(method: str, path: str, json: dict[str, Any] | None = None) -> httpx.Response:
    async def run() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json)

    return asyncio.run(run())


def test_health() -> None:
    assert request("GET", "/health").json() == {"status": "ok"}


def test_turn_returns_validated_response(monkeypatch: pytest.MonkeyPatch) -> None:
    def agent(_: str, __: str | None) -> AgentResult:
        return AgentResult(error="Agent unavailable")

    monkeypatch.setattr(turn, "run_agent", agent)
    body = request("POST", "/turn", {"text": "Open TRAPPIST-1"}).json()
    assert body == {
        "transcript": "Open TRAPPIST-1",
        "reply_text": "",
        "reply_audio": None,
        "ui_commands": [],
        "data": {"system": None, "comparison": None, "sample": None, "web_search": None},
        "error": "Agent unavailable",
        "warnings": [],
        "steps": [],
        "project": None,
    }


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"text": ""},
        {"text": "   "},
        {"text": "open", "audio": {"data_base64": "YQ==", "mime_type": "audio/webm"}},
        {"text": "open", "api_key": "never accepted"},
        {"text": "open", "current_system": {"hostname": "untrusted"}},
    ],
)
def test_turn_rejects_invalid_input(payload: dict[str, object]) -> None:
    assert request("POST", "/turn", payload).status_code == 422


def test_missing_keys_allow_startup_and_useful_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    assert request("GET", "/health").status_code == 200
    response = request("POST", "/turn", {"text": "Open TRAPPIST-1"})
    assert response.status_code == 200
    assert "not configured" in response.json()["error"]
    assert response.json()["transcript"] == "Open TRAPPIST-1"


def test_environment_defaults_to_repo_only(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (tmp_path / ".env").write_text("EXOSCOPE_TEST_ENV=parent\n")
    monkeypatch.setattr(environment, "ROOT", repo)
    monkeypatch.delenv("EXOSCOPE_ENV_FILE", raising=False)
    monkeypatch.delenv("EXOSCOPE_TEST_ENV", raising=False)
    environment.load_environment()
    import os

    assert "EXOSCOPE_TEST_ENV" not in os.environ
    monkeypatch.setenv("EXOSCOPE_ENV_FILE", "../.env")
    environment.load_environment()
    assert os.environ["EXOSCOPE_TEST_ENV"] == "parent"
    monkeypatch.delenv("EXOSCOPE_TEST_ENV")
