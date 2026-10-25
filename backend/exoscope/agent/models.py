"""The single request/response contract between frontend and backend."""

from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from exoscope.catalog import Sample, System
from exoscope.compare import Comparison
from exoscope.project.models import ProjectAction, ProjectResult
from exoscope.scene.commands import UiCommand
from exoscope.tool_steps import ToolStep as ToolStep
from exoscope.voice.models import AudioInput, ReplyAudio
from exoscope.websearch.models import WebSearchResult


class TurnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    audio: AudioInput | None = None
    current_system: str | None = Field(default=None, min_length=1, max_length=200)
    project_action: ProjectAction | None = None
    project_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")

    @model_validator(mode="after")
    def exactly_one_input(self) -> Self:
        if sum(value is not None for value in (self.text, self.audio, self.project_action)) != 1:
            raise ValueError("Provide exactly one of text, audio or project_action.")
        if self.text is not None and not self.text.strip():
            raise ValueError("Text must contain a question or instruction.")
        return self


class TurnData(BaseModel):
    system: System | None = None
    comparison: Comparison | None = None
    sample: Sample | None = None
    web_search: WebSearchResult | None = None


class TurnResponse(BaseModel):
    transcript: str
    reply_text: str
    reply_audio: ReplyAudio | None = None
    project_result: ProjectResult | None = None
    ui_commands: list[UiCommand] = Field(default_factory=list[UiCommand])
    data: TurnData = Field(default_factory=TurnData)
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    steps: list[ToolStep] = Field(default_factory=list[ToolStep])
