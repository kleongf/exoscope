"""Audio carried by the server's turn contract; credentials are never included."""

from pydantic import BaseModel, ConfigDict


class AudioInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    data_base64: str
    mime_type: str


class ReplyAudio(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    data_base64: str
    mime_type: str
