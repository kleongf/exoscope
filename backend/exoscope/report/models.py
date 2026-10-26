"""Explicit Report scopes; narrative is separate from saved numeric evidence."""

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReportInclude(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    systems: list[str] = Field(default_factory=list[str], max_length=50)
    comparisons: list[str] = Field(default_factory=list[str], max_length=50)
    samples: list[str] = Field(default_factory=list[str], max_length=50)
    web_sources: list[str] = Field(default_factory=list[str], max_length=100)

    @model_validator(mode="after")
    def nonempty(self) -> Self:
        if not any((self.systems, self.comparisons, self.samples, self.web_sources)):
            raise ValueError("Choose at least one saved item for the Report.")
        return self


class ReportSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    hostname: str = Field(min_length=1, max_length=200)
    data_url: str = Field(max_length=6_000_000, pattern=r"^data:image/png;base64,")
    captured_at: str = Field(min_length=1, max_length=100)
    simulated_julian_date: float | None = Field(default=None, allow_inf_nan=False)

    @model_validator(mode="after")
    def timestamp(self) -> Self:
        datetime.fromisoformat(self.captured_at.replace("Z", "+00:00"))
        return self


class ReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    title: str = Field(min_length=1, max_length=160, pattern=r"\S")
    include: ReportInclude
    summary: str = Field(default="Selected evidence saved in this Project.", max_length=3000)
    limitations: str = Field(default="", max_length=3000)
    snapshot: ReportSnapshot | None = None
