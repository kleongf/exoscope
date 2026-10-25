"""What a Project file holds. Items build up across turns and are never replaced by later work.

Reports copy their data when written: the HTML is rendered once, and the Project keeps only
the Report's metadata, so later changes to an item never reach a Report already written.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from exoscope.catalog import Sample, System
from exoscope.compare import Comparison


class StepRecord(BaseModel):
    """One operation that ran during a turn, as shown in the chat and a Report's tool-call log."""

    name: str
    status: Literal["completed", "failed"]
    detail: str
    elapsed_ms: float = Field(ge=0)


class TurnRecord(BaseModel):
    id: str
    at: datetime
    transcript: str
    reply_text: str
    error: str | None = None
    steps: list[StepRecord] = Field(default_factory=list[StepRecord])


class SystemItem(BaseModel):
    id: str
    turn_id: str = Field(description="The turn that last opened this System")
    opened_at: datetime
    system: System


class ComparisonItem(BaseModel):
    id: str
    turn_id: str
    made_at: datetime
    comparison: Comparison


class SampleItem(BaseModel):
    id: str
    turn_id: str
    ran_at: datetime
    sample: Sample


class WebSourceItem(BaseModel):
    """A cited Web source. Recorded once web search (#10) reports its sources in TurnData."""

    id: str
    turn_id: str
    title: str
    url: str
    domain: str
    retrieved_at: datetime


class ReportRecord(BaseModel):
    id: str
    title: str
    request: str = Field(description="What the student asked for, e.g. 'a report on ...'")
    written_at: datetime
    includes: list[str] = Field(description="IDs of the Project items the Report covers")
    file: str = Field(description="The Report's HTML file name, rendered once and never edited")


class Project(BaseModel):
    format: Literal["exoscope.project"] = "exoscope.project"
    version: Literal[1] = 1
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    current_system: str | None = Field(
        default=None, description="Hostname shown in the System view"
    )
    next_seq: int = Field(default=1, ge=1, description="Next number for turn and item IDs")
    turns: list[TurnRecord] = Field(default_factory=list[TurnRecord])
    systems: list[SystemItem] = Field(default_factory=list[SystemItem])
    samples: list[SampleItem] = Field(default_factory=list[SampleItem])
    comparisons: list[ComparisonItem] = Field(default_factory=list[ComparisonItem])
    web_sources: list[WebSourceItem] = Field(default_factory=list[WebSourceItem])
    reports: list[ReportRecord] = Field(default_factory=list[ReportRecord])

    @property
    def item_count(self) -> int:
        kinds = (self.systems, self.samples, self.comparisons, self.web_sources, self.reports)
        return sum(len(k) for k in kinds)


class ProjectSummary(BaseModel):
    """One row in the Project switcher. A file that can't be read is listed with its error."""

    id: str
    name: str
    updated_at: datetime | None
    item_count: int | None
    error: str | None = None
