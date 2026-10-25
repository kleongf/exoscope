"""The single request/response contract between frontend and backend."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from exoscope.catalog import Sample, System
from exoscope.compare import Comparison
from exoscope.scene.commands import UiCommand
from exoscope.voice.models import AudioInput, ReplyAudio


class TurnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    audio: AudioInput | None = None
    current_system: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode="after")
    def exactly_one_input(self) -> Self:
        if (self.text is None) == (self.audio is None):
            raise ValueError("Provide exactly one of text or audio.")
        if self.text is not None and not self.text.strip():
            raise ValueError("Text must contain a question or instruction.")
        return self


class TurnData(BaseModel):
    system: System | None = None
    comparison: Comparison | None = None
    sample: Sample | None = None


class ToolStep(BaseModel):
    """One operation that actually ran, timed with a monotonic clock."""

    id: str
    name: str
    status: Literal["completed", "failed"]
    detail: str
    elapsed_ms: float = Field(ge=0)


class TurnResponse(BaseModel):
    transcript: str
    reply_text: str
    reply_audio: ReplyAudio | None = None
    ui_commands: list[UiCommand] = Field(default_factory=list[UiCommand])
    data: TurnData = Field(default_factory=TurnData)
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    steps: list[ToolStep] = Field(default_factory=list[ToolStep])
