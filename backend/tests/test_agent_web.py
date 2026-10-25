"""Web dispatch is bounded, cited, and isolated from trusted archive measurements."""

from datetime import UTC, datetime

import pytest
from google.genai import types

from exoscope.agent import loop, runner
from exoscope.agent.tools import load_system as load_tool
from exoscope.agent.tools import web_search
from exoscope.catalog import CatalogError, System
from exoscope.websearch.models import WebSearchResult, WebSource, WebSupport
from tests.test_agent import answer, call, offline_system

QUESTION = "Does any of these have liquid water?"
CLAIM = "Surface liquid water has not been established on TRAPPIST-1 e."


def evidence(query: str) -> WebSearchResult:
    return WebSearchResult(
        status="ok",
        query=query,
        grounded_text=CLAIM,
        sources=[
            WebSource(
                id="web-1",
                title="TRAPPIST-1 science",
                url="https://science.nasa.gov/example",
                retrieved_at=datetime.now(UTC),
                domain="science.nasa.gov",
            )
        ],
        supports=[WebSupport(text=CLAIM, source_ids=["web-1"])],
    )


def run_search(
    monkeypatch: pytest.MonkeyPatch, question: str = QUESTION, *calls: types.Part
) -> loop.AgentResult:
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr(load_tool, "load_system", offline_system)
    responses = iter(
        [
            answer(*(calls or (call("web_search", query=question),))),
            answer(types.Part(text="A model rewrite claims certain water and invents a citation.")),
        ]
    )
    return runner.run_loop(question, "TRAPPIST-1", lambda _: next(responses))


def test_custom_declaration_does_not_mix_builtin_search() -> None:
    tool = loop.declaration()
    declarations = tool.function_declarations or []
    assert {item.name for item in declarations} == {"load_system", "web_search"}
    assert tool.google_search is None
    web = next(item for item in declarations if item.name == "web_search")
    assert web.parameters_json_schema is not None
    assert web.parameters_json_schema["required"] == ["query"]
    assert web.parameters_json_schema["additionalProperties"] is False
    assert web.parameters_json_schema["properties"]["query"]["maxLength"] == 1000


def test_liquid_water_loads_first_then_cites_original_support(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    system = offline_system("TRAPPIST-1")
    original = system.model_dump_json()

    def load(_: str) -> System:
        events.append("archive")
        return system

    def search(query: str) -> WebSearchResult:
        events.append("search")
        return evidence(query)

    monkeypatch.setattr(loop, "load_system", load)
    monkeypatch.setattr(load_tool, "load_system", load)
    monkeypatch.setattr(web_search, "search_web", search)
    responses = iter(
        [
            answer(call(name="TRAPPIST-1"), call("web_search", query=QUESTION)),
            answer(types.Part(text="Invented water certainty and numbers.")),
        ]
    )
    result = runner.run_loop(QUESTION, None, lambda _: next(responses))
    assert events == ["archive", "search"]
    assert result.error is None
    assert "archive cannot establish surface liquid water" in result.reply_text
    assert f"According to science.nasa.gov, {CLAIM}" in result.reply_text[:600]
    assert "Invented" not in result.reply_text
    assert result.data.web_search is not None
    assert result.data.web_search.grounded_text == CLAIM
    assert result.data.web_search.supports == [WebSupport(text=CLAIM, source_ids=["web-1"])]
    assert result.data.system is not None and result.data.system.model_dump_json() == original
    assert len(result.ui_commands) == 1
    assert result.ui_commands[0].model_dump()["system"] == system.model_dump()
    assert [step.status for step in result.steps] == ["completed", "completed"]
    assert result.steps[1].detail == "Retrieved cited Web sources."


@pytest.mark.parametrize(
    "question",
    [
        "How many planets are in this System?",
        "What is the planet count in TRAPPIST-1?",
        "What are these planets called?",
        "List the planets in TRAPPIST-1",
        "Which planets are in this System?",
        "What is the current System?",
        "What evidence supports planet e's radius?",
        "Why is planet e's radius larger than planet f's?",
    ],
)
def test_canonical_metadata_and_archive_evidence_have_zero_search_calls(
    monkeypatch: pytest.MonkeyPatch, question: str
) -> None:
    def forbidden(_: str) -> WebSearchResult:
        pytest.fail("Archive metadata question reached the web provider")

    monkeypatch.setattr(web_search, "search_web", forbidden)
    result = run_search(monkeypatch, question)
    assert result.data.web_search is None and result.error is not None


@pytest.mark.parametrize(
    "question",
    [
        "Compare their radii and evidence for liquid water",
        "Does planet e have an atmosphere?",
        "What causes tidal heating in planets with short orbital periods?",
        "Explain the heating mechanisms in planets with short orbital periods",
    ],
)
def test_external_or_mixed_question_is_not_blocked_by_field_keywords(
    monkeypatch: pytest.MonkeyPatch, question: str
) -> None:
    queries: list[str] = []

    def search(query: str) -> WebSearchResult:
        queries.append(query)
        return evidence(query)

    monkeypatch.setattr(web_search, "search_web", search)
    assert run_search(monkeypatch, question).data.web_search is not None
    assert queries == [question]


@pytest.mark.parametrize("batched", [True, False])
def test_duplicates_consume_one_attempt_including_batches(
    monkeypatch: pytest.MonkeyPatch, batched: bool
) -> None:
    queries: list[str] = []

    def search(query: str) -> WebSearchResult:
        queries.append(query)
        return evidence(query)

    monkeypatch.setattr(web_search, "search_web", search)
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr(load_tool, "load_system", offline_system)
    part = call("web_search", query=QUESTION)
    rounds = [answer(part, part)] if batched else [answer(part), answer(part)]
    responses = iter([*rounds, answer(types.Part(text="Done"))])
    result = runner.run_loop(QUESTION, "TRAPPIST-1", lambda _: next(responses))
    assert queries == [QUESTION]
    assert result.data.web_search is not None and result.data.web_search.status == "ok"
    assert "According to science.nasa.gov" in result.reply_text
    assert [step.status for step in result.steps] == ["completed", "failed"]
    assert "already used" in result.steps[1].detail


def test_failure_is_consumed_once_and_no_sdk_error_or_stale_citation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queries: list[str] = []

    def search(query: str) -> WebSearchResult:
        queries.append(query)
        raise RuntimeError("SDK secret-key and request URL")

    monkeypatch.setattr(web_search, "search_web", search)
    result = run_search(
        monkeypatch, QUESTION, call("web_search", query=QUESTION), call("web_search", query="retry")
    )
    assert queries == [QUESTION]
    assert result.error is not None  # ToolError is retained by the generic registry loop.
    assert result.data.web_search is not None
    assert result.data.web_search.status == "unavailable"
    assert result.data.web_search.sources == [] and result.data.web_search.supports == []
    assert "no Web sources" in result.reply_text
    assert "According to" not in result.reply_text
    assert "secret-key" not in result.model_dump_json()
    assert result.data.system is not None
    assert [step.status for step in result.steps] == ["failed", "failed"]
    assert "no Web sources" in result.steps[0].detail
    assert "already used" in result.steps[1].detail


def test_source_free_or_unavailable_output_never_survives_as_cited_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stale = evidence(QUESTION)
    for value in [
        stale.model_copy(update={"status": "unavailable"}),
        WebSearchResult(status="ok", query=QUESTION, grounded_text="Uncited water claim"),
    ]:

        def search(_: str, value: WebSearchResult = value) -> WebSearchResult:
            return value

        monkeypatch.setattr(web_search, "search_web", search)
        result = run_search(monkeypatch)
        assert result.data.web_search is not None
        assert result.data.web_search.status == "unavailable"
        assert result.data.web_search.sources == []
        assert result.data.web_search.grounded_text == ""
        assert "According to" not in result.reply_text
        assert result.steps[0].status == "failed"
        assert "no Web sources" in result.steps[0].detail


def test_web_call_counts_toward_overall_five_tool_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    loaded: list[str] = []
    searched: list[str] = []

    def load(name: str) -> System:
        loaded.append(name)
        return offline_system(name)

    def search(query: str) -> WebSearchResult:
        searched.append(query)
        return evidence(query)

    monkeypatch.setattr(loop, "load_system", load)
    monkeypatch.setattr(load_tool, "load_system", load)
    monkeypatch.setattr(web_search, "search_web", search)
    result = runner.run_loop(
        QUESTION,
        None,
        lambda _: answer(
            call(name="TRAPPIST-1"),
            call("web_search", query=QUESTION),
            *[call(name="TRAPPIST-1") for _ in range(4)],
        ),
    )
    assert len(loaded) == 4 and searched == [QUESTION]
    assert result.error is not None and "limit" in result.error
    assert len(result.ui_commands) == 4
    assert len(result.steps) == 5


def test_search_requires_successful_archive_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(_: str) -> System:
        raise CatalogError("Current System absent from Snapshot")

    def forbidden(_: str) -> WebSearchResult:
        pytest.fail("Search ran before archive context was obtained")

    monkeypatch.setattr(loop, "load_system", fail)
    monkeypatch.setattr(load_tool, "load_system", fail)
    monkeypatch.setattr(web_search, "search_web", forbidden)
    responses = iter([answer(call("web_search", query=QUESTION)), answer(types.Part(text="Done"))])
    result = runner.run_loop(QUESTION, "unknown", lambda _: next(responses))
    assert result.data.web_search is None and result.data.system is None
    assert "Load or refresh" in result.reply_text
    assert any("Current System data is unavailable" in item for item in result.warnings)


def test_provider_failure_retains_archive_commands_and_web_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr(load_tool, "load_system", offline_system)
    monkeypatch.setattr(web_search, "search_web", evidence)
    responses = iter([answer(call(name="TRAPPIST-1"), call("web_search", query=QUESTION))])
    result = runner.run_loop(QUESTION, None, lambda _: next(responses))
    assert result.error is not None and "unverified" in result.error
    assert result.data.system is not None and result.ui_commands
    assert result.data.web_search is not None and result.data.web_search.grounded_text == CLAIM
