"""The shape every agent tool shares.

A tool validates its arguments with a strict Pydantic model, does model-free work through a
feature module, writes UI commands or data into the AgentResult, and returns the JSON payload
the model sees plus a one-line detail for the chat's step list. Honest failures raise ToolError
(or a feature error listed in TOOL_ERRORS); the loop reports them and never claims success.
"""

from collections.abc import Callable
from dataclasses import dataclass

from pydantic import BaseModel

from exoscope.agent.result import AgentResult
from exoscope.catalog import CatalogError
from exoscope.scene.planets import SceneError


class ToolError(Exception):
    """A tool could not do what was asked. The message is shown to the student."""


TOOL_ERRORS: tuple[type[Exception], ...] = (ToolError, CatalogError, SceneError)


@dataclass(frozen=True)
class ToolOutput:
    payload: dict[str, object]
    detail: str


@dataclass(frozen=True)
class Tool[A: BaseModel]:
    name: str
    description: str
    arguments: type[A]
    run: Callable[[A, AgentResult], ToolOutput]

    def invoke(self, raw: object, result: AgentResult) -> ToolOutput:
        return self.run(self.arguments.model_validate(raw), result)
