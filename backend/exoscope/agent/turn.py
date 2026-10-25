"""The single request/response contract between frontend and backend."""

from pydantic import BaseModel, Field

from exoscope.scene.commands import UiCommand


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class TurnResponse(BaseModel):
    transcript: str
    reply_text: str
    ui_commands: list[UiCommand]


def handle_turn(request: TurnRequest) -> TurnResponse:
    """Stub: echoes the transcript. The Gemma loop replaces this."""
    return TurnResponse(transcript=request.text, reply_text="", ui_commands=[])
