"""Offline observations must distinguish real tool/grounding evidence from model prose."""

from typing import Any
from unittest.mock import MagicMock

import pytest
from google.genai import types

from exoscope.service_smoke.gemma import check_gemma, exercise, grounded_sources


def response(parts: list[dict[str, Any]]) -> types.GenerateContentResponse:
    return types.GenerateContentResponse.model_validate(
        {"candidates": [{"content": {"role": "model", "parts": parts}}]}
    )


def tool_response(name: str = "smoke_probe", identifier: str = "exoscope-smoke") -> dict[str, Any]:
    return {
        "function_call": {"id": "call-1", "name": name, "args": {"id": identifier}},
        "thought_signature": b"preserve-me",
    }


def metadata() -> dict[str, Any]:
    return {
        "web_search_queries": ["NASA Exoplanet Archive"],
        "grounding_chunks": [
            {
                "web": {
                    "title": "NASA Exoplanet Archive",
                    "uri": "https://exoplanetarchive.ipac.caltech.edu/",
                }
            }
        ],
        "grounding_supports": [
            {"segment": {"text": "Archive website."}, "grounding_chunk_indices": [0]}
        ],
    }


@pytest.mark.parametrize("mixed", [False, True])
def test_round_trip_requires_returned_nonce_and_preserves_call(mixed: bool) -> None:
    calls = 0
    first = response([tool_response()])

    def generate(
        contents: list[types.Content], tools: list[types.Tool]
    ) -> types.GenerateContentResponse:
        nonlocal calls
        calls += 1
        assert tools[0].function_declarations
        assert bool(len(tools) == 2 and tools[1].google_search is not None) == mixed
        if calls == 1:
            return first
        assert first.candidates
        assert contents[1] is first.candidates[0].content
        assert contents[-1].parts
        result = contents[-1].parts[0].function_response
        assert result and result.response and result.id == "call-1"
        nonce = result.response["nonce"]
        assert nonce not in str(contents[0])
        final = response([{"text": f"Nonce {nonce}. Archive website."}])
        assert final.candidates
        if mixed:
            final.candidates[0].grounding_metadata = types.GroundingMetadata.model_validate(
                metadata()
            )
        return final

    assert "returned nonce observed" in exercise(generate, mixed=mixed)
    assert calls == 2


@pytest.mark.parametrize(
    "parts, message",
    [
        ([{"text": 'I called smoke_probe({"id":"exoscope-smoke"}).'}], "No observed"),
        ([tool_response("unexpected")], "Unexpected tool"),
        ([tool_response(identifier="wrong")], "Unexpected tool"),
        ([tool_response(), tool_response()], "multiple calls"),
    ],
)
def test_text_claims_and_invalid_tool_calls_fail(parts: list[dict[str, Any]], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        exercise(lambda _contents, _tools: response(parts), mixed=False)


def test_repeated_calls_fail() -> None:
    with pytest.raises(ValueError, match="repeated"):
        exercise(lambda _contents, _tools: response([tool_response()]), mixed=False)


def test_answer_ignoring_tool_result_fails() -> None:
    def generate(
        contents: list[types.Content], _tools: list[types.Tool]
    ) -> types.GenerateContentResponse:
        return response([tool_response()] if len(contents) == 1 else [{"text": "Made-up nonce"}])

    with pytest.raises(ValueError, match="result-grounded"):
        exercise(generate, mixed=False)


def test_no_candidate_fails() -> None:
    with pytest.raises(ValueError, match="No model content"):
        exercise(lambda _contents, _tools: types.GenerateContentResponse(), mixed=False)


@pytest.mark.parametrize(
    "missing", ["queries", "chunks", "supports", "bad_index", "bad_uri", "text"]
)
def test_search_claim_without_complete_grounding_fails(missing: str) -> None:
    data = metadata()
    if missing in {"queries", "chunks", "supports"}:
        data.pop(
            {
                "queries": "web_search_queries",
                "chunks": "grounding_chunks",
                "supports": "grounding_supports",
            }[missing]
        )
    elif missing == "bad_index":
        data["grounding_supports"][0]["grounding_chunk_indices"] = [99]
    elif missing == "bad_uri":
        data["grounding_chunks"][0]["web"]["uri"] = "javascript:alert(1)"
    else:
        data["grounding_supports"][0]["segment"]["text"] = "Absent from answer"
    candidate = types.Candidate(grounding_metadata=types.GroundingMetadata.model_validate(data))
    assert grounded_sources(candidate, "Archive website.") == 0


def test_grounding_counts_only_distinct_sources_supporting_answer_text() -> None:
    data = metadata()
    data["grounding_chunks"].append(
        {"web": {"title": "Uncited source", "uri": "https://example.org/uncited"}}
    )
    data["grounding_supports"].append(data["grounding_supports"][0])
    candidate = types.Candidate(grounding_metadata=types.GroundingMetadata.model_validate(data))
    assert grounded_sources(candidate, "Archive website.") == 1


def test_accepting_mixed_tools_is_not_a_pass() -> None:
    def generate(
        contents: list[types.Content], _tools: list[types.Tool]
    ) -> types.GenerateContentResponse:
        if len(contents) == 1:
            return response([tool_response()])
        assert contents[-1].parts
        result = contents[-1].parts[0].function_response
        assert result and result.response
        return response([{"text": f"Nonce {result.response['nonce']}. I searched Google."}])

    with pytest.raises(ValueError, match="no observed search-grounded citation"):
        exercise(generate, mixed=True)


def test_missing_gemini_key_is_failure() -> None:
    with pytest.raises(ValueError, match="Missing GEMINI_API_KEY"):
        check_gemma("", mixed=False)


def test_explicit_model_round_trip_reports_the_model_actually_tested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    factory = MagicMock()
    generate = factory.return_value.__enter__.return_value.models.generate_content

    def respond(**kwargs: Any) -> types.GenerateContentResponse:
        assert kwargs["model"] == "gemma-4-26b-a4b-it"
        contents = kwargs["contents"]
        if len(contents) == 1:
            return response([tool_response()])
        nonce = contents[-1].parts[0].function_response.response["nonce"]
        return response([{"text": f"Returned nonce: {nonce}"}])

    generate.side_effect = respond
    monkeypatch.setattr("exoscope.service_smoke.gemma.genai.Client", factory)
    detail = check_gemma("test-key", mixed=False, model="gemma-4-26b-a4b-it")
    assert detail.startswith("gemma-4-26b-a4b-it:")
    assert "gemma-4-31b-it" not in detail
    assert generate.call_count == 2


@pytest.mark.parametrize("mixed", [False, True])
def test_sdk_uses_documented_model_and_combination_flag(
    mixed: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory = MagicMock()
    client = factory.return_value.__enter__.return_value
    client.models.generate_content.return_value = response([{"text": "no observed tool call"}])
    monkeypatch.setattr("exoscope.service_smoke.gemma.genai.Client", factory)
    with pytest.raises(ValueError, match="No observed"):
        check_gemma("test-key", mixed=mixed)
    kwargs = client.models.generate_content.call_args.kwargs
    assert kwargs["model"] == "gemma-4-31b-it"
    config = kwargs["config"]
    assert isinstance(config, types.GenerateContentConfig)
    assert config.automatic_function_calling and config.automatic_function_calling.disable
    assert (
        bool(config.tool_config and config.tool_config.include_server_side_tool_invocations)
        == mixed
    )
    assert factory.call_args.kwargs["http_options"].timeout == 60_000
    assert factory.call_args.kwargs["http_options"].retry_options.attempts == 1
    factory.return_value.__exit__.assert_called_once()
