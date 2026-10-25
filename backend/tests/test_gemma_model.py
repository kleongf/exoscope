"""Keep model choice explicit and fixed across the function/result conversation."""

from unittest.mock import MagicMock

import pytest
from google.genai import errors, types

from exoscope.agent import loop
from exoscope.agent.model_config import gemma_model
from exoscope.agent.tools import load_system as load_tool
from tests.test_agent import answer, call, offline_system


def test_model_configuration_is_read_after_environment_loading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("GEMMA_MODEL", raising=False)
    assert gemma_model() == "gemma-4-26b-a4b-it"
    monkeypatch.setenv("GEMMA_MODEL", " gemma-4-31b-it ")
    assert gemma_model() == "gemma-4-31b-it"


@pytest.mark.parametrize("configured", ["gemini-flash-latest", "", "private-invalid-value"])
def test_invalid_model_fails_before_client_creation(
    monkeypatch: pytest.MonkeyPatch, configured: str
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    monkeypatch.setenv("GEMMA_MODEL", configured)
    factory = MagicMock()
    monkeypatch.setattr(loop.genai, "Client", factory)
    result = loop.run_agent("Open TRAPPIST-1")
    assert result.error and not result.ui_commands
    assert "private-invalid-value" not in result.model_dump_json()
    assert "test-secret" not in result.model_dump_json()
    factory.assert_not_called()


@pytest.mark.parametrize("model", ["gemma-4-26b-a4b-it", "gemma-4-31b-it"])
def test_selected_model_is_preserved_after_executing_tool(
    monkeypatch: pytest.MonkeyPatch, model: str
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    monkeypatch.setenv("GEMMA_MODEL", model)
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr(load_tool, "load_system", offline_system)
    factory = MagicMock()
    generate = factory.return_value.__enter__.return_value.models.generate_content
    responses = iter(
        [answer(call(name="TRAPPIST-1")), answer(types.Part(text="Loaded from Snapshot."))]
    )

    def respond(**_: object) -> types.GenerateContentResponse:
        # A configuration change cannot switch models halfway through a conversation.
        monkeypatch.setenv("GEMMA_MODEL", "gemini-flash-latest")
        return next(responses)

    generate.side_effect = respond
    monkeypatch.setattr(loop.genai, "Client", factory)
    result = loop.run_agent("Open TRAPPIST-1")
    assert result.error is None and len(result.ui_commands) == 1
    assert generate.call_count == 2
    assert all(request.kwargs["model"] == model for request in generate.call_args_list)


def test_server_error_never_silently_changes_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    monkeypatch.setenv("GEMMA_MODEL", "gemma-4-31b-it")
    factory = MagicMock()
    generate = factory.return_value.__enter__.return_value.models.generate_content
    generate.side_effect = errors.ServerError(500, {"error": {"message": "test-secret"}})
    monkeypatch.setattr(loop.genai, "Client", factory)
    result = loop.run_agent("Open TRAPPIST-1")
    assert result.error and "test-secret" not in result.model_dump_json()
    generate.assert_called_once()
    assert generate.call_args.kwargs["model"] == "gemma-4-31b-it"
