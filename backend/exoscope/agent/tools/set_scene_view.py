"""set_scene_view: change the System view. Planets are checked against the open System."""

from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import Tool, ToolOutput
from exoscope.scene.commands import (
    MAX_DAYS_PER_SECOND,
    ColorBy,
    FocusPlanet,
    SetColorBy,
    SetLabels,
    SetTimeScale,
    UiCommand,
)
from exoscope.scene.planets import resolve_planet


class SceneArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")
    focus: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        description="Planet to focus on: its archive name or letter, e.g. 'TRAPPIST-1 e' or 'e'.",
    )
    days_per_second: float | None = Field(
        default=None,
        ge=0,
        le=MAX_DAYS_PER_SECOND,
        description="Simulated days per real second. 0 pauses; 0.5 is the default pace.",
    )
    labels: bool | None = Field(default=None, description="Show or hide planet labels.")
    color_by: ColorBy | None = Field(
        default=None, description="Colour planets by an archive property, or 'none'."
    )

    @model_validator(mode="after")
    def something_to_change(self) -> Self:
        if all(value is None for value in self.model_dump().values()):
            raise ValueError("Give at least one of focus, days_per_second, labels or color_by.")
        return self


def _describe_pace(days_per_second: float) -> str:
    return "paused time" if days_per_second == 0 else f"time set to {days_per_second:g} days/s"


def _run(arguments: SceneArguments, result: AgentResult) -> ToolOutput:
    commands: list[UiCommand] = []
    done: list[str] = []
    # Validate everything before emitting anything, so a bad planet changes nothing.
    if arguments.focus is not None:
        name = resolve_planet(result.data.system, arguments.focus)
        commands.append(FocusPlanet(name=name))
        done.append(f"focused {name}")
    if arguments.days_per_second is not None:
        commands.append(SetTimeScale(days_per_second=arguments.days_per_second))
        done.append(_describe_pace(arguments.days_per_second))
    if arguments.labels is not None:
        commands.append(SetLabels(visible=arguments.labels))
        done.append("labels shown" if arguments.labels else "labels hidden")
    if arguments.color_by is not None:
        commands.append(SetColorBy(property=arguments.color_by))
        label = arguments.color_by.replace("_", " ")
        done.append("fixed colours" if arguments.color_by == "none" else f"coloured by {label}")
    result.ui_commands.extend(commands)
    summary = "; ".join(done)
    return ToolOutput({"applied": done}, summary[:1].upper() + summary[1:] + ".")


SET_SCENE_VIEW = Tool(
    name="set_scene_view",
    description=(
        "Change the System view: focus the camera on one planet of the open System, set the "
        "simulated time pace, show or hide labels, or colour planets by a property. Only planets "
        "of the currently open System can be focused."
    ),
    arguments=SceneArguments,
    run=_run,
)
