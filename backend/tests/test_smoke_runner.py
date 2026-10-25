import json
from collections.abc import Callable
from pathlib import Path
from urllib.parse import quote

import pytest

from exoscope.service_smoke.__main__ import configuration, main, redact, run_checks


def test_explicit_dotenv_only_and_environment_precedence(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".env").write_text("XAI_API_KEY=parent-should-not-load\n")
    child = tmp_path / "child"
    child.mkdir()
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    assert "XAI_API_KEY" not in configuration(child / ".env")
    explicit = child / "test.env"
    explicit.write_text("XAI_API_KEY=file-value\nGEMINI_API_KEY=${XAI_API_KEY}\n")
    monkeypatch.setenv("XAI_API_KEY", "environment-value")
    config = configuration(explicit)
    assert config["XAI_API_KEY"] == "environment-value"
    assert config["GEMINI_API_KEY"] == "${XAI_API_KEY}"


def test_errors_redacted_before_truncation_and_no_forged_status_lines() -> None:
    secret = 'test/key+with"quotes'
    message = f"{secret} {quote(secret, safe='')} {json.dumps(secret)} Bearer unknown-token"
    result = redact(message + "\n\x1bPASS 2 forged", {"XAI_API_KEY": secret})
    assert secret not in result and quote(secret, safe="") not in result
    assert json.dumps(secret)[1:-1] not in result and "unknown-token" not in result
    assert "\n" not in result and "\x1b" not in result
    assert "[REDACTED]" in result
    assert secret not in redact("x" * 2400 + secret, {"XAI_API_KEY": secret})


def test_failure_continues_all_checks_and_returns_nonzero(
    capsys: pytest.CaptureFixture[str],
) -> None:
    observed: list[int] = []

    def failing() -> str:
        observed.append(1)
        raise RuntimeError("HTTP 401 invalid key test-key")

    def succeeding() -> str:
        observed.append(2)
        return "observed detail"

    checks: list[tuple[str, Callable[[], str]]] = [
        ("1 function", failing),
        ("2 mixed", succeeding),
        ("3 voice", failing),
    ]
    assert run_checks(checks, {"XAI_API_KEY": "test-key"}) == 1
    out = capsys.readouterr().out
    assert observed == [1, 2, 1]
    assert "test-key" not in out
    assert "FAIL 1" in out and "PASS 2" in out and "FAIL 3" in out
    assert "HTTP 401" in out and "Agent design blocked" in out


def test_all_pass_returns_zero() -> None:
    assert run_checks([("1 test", lambda: "observed")], {}) == 0


def test_missing_keys_print_three_failures_without_network(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    for key in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "XAI_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr("sys.argv", ["smoke", "--env-file", str(tmp_path / "absent.env")])
    assert main() == 1
    out = capsys.readouterr().out
    assert out.count("FAIL ") == 3 and "PASS " not in out
    assert "Missing GEMINI_API_KEY" in out and "Missing XAI_API_KEY" in out
