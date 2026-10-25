"""What one agent turn produced. Tools write into it; the loop and /turn read it."""

from pydantic import BaseModel, Field

from exoscope.agent.models import ToolStep, TurnData
from exoscope.scene.commands import UiCommand


class AgentResult(BaseModel):
    reply_text: str = ""
    ui_commands: list[UiCommand] = Field(default_factory=list[UiCommand])
    data: TurnData = Field(default_factory=TurnData)
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    steps: list[ToolStep] = Field(default_factory=list[ToolStep])

    def warn(self, warning: str) -> None:
        if warning not in self.warnings:
            self.warnings.append(warning)
