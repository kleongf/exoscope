"""Shared tool execution records for responses and durable conversation history."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ToolStep(BaseModel):
    """One operation that actually ran, timed with a monotonic clock."""

    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    id: str
    name: str
    status: Literal["completed", "failed"]
    detail: str
    elapsed_ms: float = Field(ge=0)
