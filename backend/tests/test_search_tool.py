"""search_catalog as an agent tool: Interpretations travel with the Sample; errors stay honest."""

from functools import partial

import pytest

from exoscope.agent import loop
from exoscope.agent.tools import search_catalog as search_tool
from exoscope.agent.tools.registry import TOOLS
from exoscope.catalog import search_catalog
from tests.model_fakes import Item, answer
from tests.model_fakes import call as fake_call
from tests.test_search_catalog import offline, unavailable


def call(**arguments: object) -> Item:
    return fake_call("search_catalog", "t", **arguments)


@pytest.fixture(autouse=True)
def offline_search(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        search_tool,
        "search_catalog",
        partial(search_catalog, tap=unavailable, population=offline),
    )


def run(arguments: dict[str, object]) -> loop.AgentResult:
    responses = iter([answer(call(**arguments)), answer("Done.")])
    return loop.run_loop("Find small planets", None, lambda _: next(responses))


def test_registered() -> None:
    assert "search_catalog" in TOOLS


def test_sample_and_interpretations_reach_turn_data() -> None:
    result = run(
        {
            "filters": [
                {"field": "radius", "op": "<", "value": 2},
                {"field": "period", "op": "<", "value": 10},
            ],
            "interpretations": [{"term": "small", "as": "radius < 2 Earth radii"}],
        }
    )
    assert result.error is None
    sample = result.data.sample
    assert sample is not None and sample.planets
    assert sample.interpretations[0].term == "small"
    assert sample.provenance.mode == "snapshot"
    assert result.steps[0].status == "completed" and "excluded" in result.steps[0].detail


def test_loaded_word_gets_a_caveat() -> None:
    result = run(
        {
            "filters": [{"field": "radius", "op": "between", "value": 0.8, "upper": 1.5}],
            "interpretations": [{"term": "Earth-like", "as": "0.8-1.5 Earth radii"}],
        }
    )
    assert result.data.sample is not None
    assert result.data.sample.interpretations[0].caveat


def test_unknown_field_is_an_honest_error() -> None:
    result = run({"filters": [{"field": "habitability", "op": ">", "value": 0.5}]})
    assert result.data.sample is None
    assert result.error and "habitability" in result.error
    assert result.steps[0].status == "failed"
