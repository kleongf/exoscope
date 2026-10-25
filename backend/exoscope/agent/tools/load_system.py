"""load_system: open one System in the System view."""

from pydantic import BaseModel, ConfigDict, Field

from exoscope.agent import brief
from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import Tool, ToolOutput
from exoscope.catalog import load_system
from exoscope.scene.commands import LoadSystem


class LoadArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str = Field(min_length=1, max_length=200)


def _run(arguments: LoadArguments, result: AgentResult) -> ToolOutput:
    system = load_system(arguments.name)
    result.data.system = system
    result.ui_commands.append(LoadSystem(system=system))
    if system.provenance.mode == "snapshot":
        result.warn("Live archive unavailable; using dated Snapshot data.")
    return ToolOutput({"system": brief.system(system)}, f"Loaded {system.hostname}.")


LOAD_SYSTEM = Tool(
    name="load_system",
    description="Load one System by case/spacing-insensitive archive hostname.",
    arguments=LoadArguments,
    run=_run,
)
