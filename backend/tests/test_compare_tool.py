"""The compare agent tool: strict arguments, current-System default, honest errors."""

import json

import pytest
from google.genai import types

from exoscope.agent import loop
from exoscope.agent.result import AgentResult
from exoscope.agent.tools import compare as compare_tool
from exoscope.agent.tools.base import ToolError
from exoscope.agent.tools.compare import COMPARE
from exoscope.agent.tools.registry import TOOLS, declaration
from exoscope.catalog import System, load_system
from tests.catalog_fakes import unavailable


def snapshot_system(name: str) -> System:
    return load_system(name, tap=unavailable)


def with_current(name: str = "TRAPPIST-1") -> AgentResult:
    result = AgentResult()
    result.data.system = snapshot_system(name)
    return result


def test_compare_is_registered_and_declared() -> None:
    assert "compare" in TOOLS
    names = [d.name for d in declaration().function_declarations or []]
    assert names == ["load_system", "compare", "search_catalog", "set_scene_view", "web_search"]


def test_compares_the_current_system_and_writes_turn_data() -> None:
    result = with_current()
    output = COMPARE.invoke({"x": "radius", "y": "insolation"}, result)

    comparison = result.data.comparison
    assert comparison is not None
    assert len(comparison.plotted) == 7
    assert (
        output.detail
        == "Compared insolation vs planet radius for 7 planets (7 plotted, 0 excluded)."
    )
    text = json.dumps(output.payload)
    assert '"axes": {"x": "Planet radius (Earth radii)", "y": "Insolation (Earth flux)"}' in text
    assert "reference" not in text  # sources go to the UI via TurnData, not to the model
    assert "Live archive unavailable; using dated Snapshot data." in result.warnings


def test_planet_names_are_matched_case_and_spacing_insensitively() -> None:
    result = with_current()
    COMPARE.invoke(
        {"x": "radius", "y": "mass", "planets": ["trappist-1 E", "TRAPPIST-1  f"]}, result
    )
    assert result.data.comparison is not None
    assert [r.planet for r in result.data.comparison.rows] == ["TRAPPIST-1 e", "TRAPPIST-1 f"]


def test_unknown_planet_and_no_current_system_are_honest_tool_errors() -> None:
    with pytest.raises(ToolError, match="Not in the loaded Systems"):
        COMPARE.invoke({"x": "radius", "y": "mass", "planets": ["Planet Z"]}, with_current())
    with pytest.raises(ToolError, match="Open a System first"):
        COMPARE.invoke({"x": "radius", "y": "mass"}, AgentResult())


def test_named_systems_are_loaded_through_the_catalog(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(compare_tool, "load_system", snapshot_system)
    result = AgentResult()
    COMPARE.invoke({"x": "radius", "y": "orbital_period", "systems": ["TOI-700"]}, result)
    assert result.data.comparison is not None
    assert {r.hostname for r in result.data.comparison.rows} == {"TOI-700"}


def test_unlisted_property_never_reaches_compare_through_the_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(loop, "load_system", snapshot_system)
    call = types.Part(
        function_call=types.FunctionCall(
            name="compare", args={"x": "radius", "y": "habitability"}, id="c1"
        )
    )
    responses = iter(
        [
            types.GenerateContentResponse(
                candidates=[types.Candidate(content=types.Content(role="model", parts=[call]))]
            ),
            types.GenerateContentResponse(
                candidates=[
                    types.Candidate(
                        content=types.Content(
                            role="model", parts=[types.Part(text="I could not compare that.")]
                        )
                    )
                ]
            ),
        ]
    )
    result = loop.run_loop(
        "compare radius and habitability", "TRAPPIST-1", lambda _: next(responses)
    )
    assert result.data.comparison is None
    assert result.error == "Invalid compare arguments."
    assert result.steps[-1].status == "failed"
