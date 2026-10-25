"""set_scene_view validates against the open System and never claims a change it didn't make."""

import pytest
from google.genai import types
from pydantic import ValidationError

from exoscope.agent import loop
from exoscope.agent.result import AgentResult
from exoscope.agent.tools.set_scene_view import SET_SCENE_VIEW
from exoscope.catalog import CatalogUnavailableError, System, load_system
from exoscope.catalog.tap import Row
from exoscope.scene.planets import SceneError, resolve_planet


def offline_system(name: str) -> System:
    def unavailable(_: str) -> list[Row]:
        raise CatalogUnavailableError("Archive unavailable in offline test.")

    return load_system(name, tap=unavailable)


@pytest.fixture
def trappist() -> System:
    return offline_system("TRAPPIST-1")


@pytest.mark.parametrize("reference", ["TRAPPIST-1 e", "trappist 1 e", "planet e", "E", "e"])
def test_planet_references_resolve_to_canonical_names(trappist: System, reference: str) -> None:
    assert resolve_planet(trappist, reference) == "TRAPPIST-1 e"


def test_unknown_planet_and_no_system_are_honest_errors(trappist: System) -> None:
    with pytest.raises(SceneError, match="has no planet 'z'"):
        resolve_planet(trappist, "z")
    with pytest.raises(SceneError, match="No System is open"):
        resolve_planet(None, "e")


def test_all_changes_become_validated_commands(trappist: System) -> None:
    result = AgentResult()
    result.data.system = trappist
    raw = {"focus": "planet e", "days_per_second": 10, "labels": False, "color_by": "insolation"}
    output = SET_SCENE_VIEW.invoke(raw, result)
    kinds = [command.kind for command in result.ui_commands]
    assert kinds == ["focus_planet", "set_time_scale", "set_labels", "set_color_by"]
    assert output.detail.startswith("Focused TRAPPIST-1 e; time set to 10 days/s")


def test_bad_planet_emits_nothing_even_with_other_changes(trappist: System) -> None:
    result = AgentResult()
    result.data.system = trappist
    with pytest.raises(SceneError):
        SET_SCENE_VIEW.invoke({"focus": "z", "days_per_second": 10}, result)
    assert result.ui_commands == []


@pytest.mark.parametrize(
    "raw",
    [{}, {"days_per_second": -1}, {"days_per_second": 5000}, {"color_by": "mass"}, {"x": 1}],
)
def test_invalid_arguments_are_rejected(raw: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        SET_SCENE_VIEW.invoke(raw, AgentResult())


def _answer(*parts: types.Part) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=list(parts)))]
    )


def _scene_call(**arguments: object) -> types.Part:
    return types.Part(
        function_call=types.FunctionCall(id="scene", name="set_scene_view", args=arguments)
    )


def _serve(monkeypatch: pytest.MonkeyPatch, system: System) -> None:
    """The loop refreshes the current System as trusted context for the tool."""

    def load(_: str) -> System:
        return system

    monkeypatch.setattr(loop, "load_system", load)


def test_loop_rejects_unknown_planet_in_current_system(
    monkeypatch: pytest.MonkeyPatch, trappist: System
) -> None:
    _serve(monkeypatch, trappist)
    replies = iter([_answer(_scene_call(focus="z")), _answer(types.Part(text="Focused z."))])
    result = loop.run_loop("Focus on planet z", "TRAPPIST-1", lambda _: next(replies))
    assert result.ui_commands == []
    assert result.error is not None and "has no planet 'z'" in result.error
    assert result.reply_text == result.error
    assert result.steps[-1].status == "failed"


def test_loop_focus_and_speed_in_current_system(
    monkeypatch: pytest.MonkeyPatch, trappist: System
) -> None:
    _serve(monkeypatch, trappist)
    replies = iter(
        [
            _answer(_scene_call(focus="e", days_per_second=10)),
            _answer(types.Part(text="Focused on TRAPPIST-1 e and sped up time.")),
        ]
    )
    result = loop.run_loop("Focus on e and speed up", "TRAPPIST-1", lambda _: next(replies))
    assert result.error is None
    assert [command.kind for command in result.ui_commands] == ["focus_planet", "set_time_scale"]
    assert result.steps[-1].detail == "Focused TRAPPIST-1 e; time set to 10 days/s."
