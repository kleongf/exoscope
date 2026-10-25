"""Versioned, validated Project documents and /turn Project operations."""

# ruff: noqa: N815 -- ProjectState preserves the frontend's durable field names.

import json
from datetime import UTC, datetime
from typing import Literal, Self
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from exoscope.catalog import System
from exoscope.catalog.models import Provenance
from exoscope.catalog.sample_models import Sample
from exoscope.compare.models import Comparison
from exoscope.tool_steps import ToolStep
from exoscope.websearch.models import WebSearchResult


def now() -> str:
    return datetime.now(UTC).isoformat()


class ReportRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[a-f0-9]{32}$")
    title: str
    created_at: str
    html: str
    included: tuple[str, ...]


class ConversationTurn(BaseModel):
    """Complete durable chat record; absent fields indicate lost or malformed work."""

    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    id: int
    question: str
    reply: str
    startedAt: float
    finishedAt: float | None
    steps: list[ToolStep]
    provenance: Provenance | None
    error: str | None
    warnings: list[str]
    appliedCommands: int
    webSearch: WebSearchResult | None
    hasSpokenReply: bool


class SavedComparison(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: int
    comparison: Comparison


class SavedSample(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: int
    sample: Sample


class ProjectState(BaseModel):
    """Durable work only; microphone resources and generated audio are never saved."""

    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    system: System | None = None
    loadedSystems: list[System] = Field(default_factory=list[System])
    focusedPlanetName: str | None = None
    daysPerSecond: float = Field(default=0.5, ge=0, le=1000)
    drawerOpen: bool = False
    turns: list[ConversationTurn] = Field(default_factory=list[ConversationTurn])
    samples: list[SavedSample] = Field(default_factory=list[SavedSample])
    activeSampleId: int | None = None
    drawerView: Literal["comparison", "sample"] = "comparison"
    comparisons: list[SavedComparison] = Field(default_factory=list[SavedComparison])
    activeComparisonId: int | None = None
    sceneSettings: dict[str, JsonValue] = Field(default_factory=dict[str, JsonValue])
    draft: str = ""
    transcript: str = ""
    replyText: str = ""

    @model_validator(mode="after")
    def finite_json(self) -> Self:
        # JsonValue dictionaries also need this check: JSON cannot preserve NaN/Infinity.
        json.dumps(self.model_dump(mode="json"), allow_nan=False)
        return self


class Project(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    version: Literal[1] = 1
    id: str = Field(default_factory=lambda: uuid4().hex, pattern=r"^[a-f0-9]{32}$")
    title: str = Field(default="Untitled Project", min_length=1, max_length=160)
    revision: int = Field(default=0, ge=0)
    created_at: str = Field(default_factory=now)
    updated_at: str = Field(default_factory=now)
    state: ProjectState = Field(default_factory=ProjectState)
    reports: list[ReportRecord] = Field(default_factory=list[ReportRecord])


class ProjectSummary(BaseModel):
    id: str
    title: str
    revision: int
    updated_at: str


class ProjectAction(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    operation: Literal["bootstrap", "list", "create", "load", "save"]
    id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    title: str | None = Field(default=None, min_length=1, max_length=160)
    revision: int | None = Field(default=None, ge=0)
    state: ProjectState | None = None

    @model_validator(mode="after")
    def operation_fields(self) -> Self:
        required = {"load": {"id"}, "save": {"id", "revision", "state"}}
        allowed: dict[str, set[str]] = {
            "bootstrap": set(),
            "list": set(),
            "create": {"title"},
            "load": {"id"},
            "save": {"id", "title", "revision", "state"},
        }
        supplied = {key for key, value in self.model_dump().items() if value is not None}
        supplied.discard("operation")
        if not required.get(self.operation, set()) <= supplied:
            raise ValueError(f"Missing required fields for Project {self.operation}.")
        if supplied - allowed[self.operation]:
            raise ValueError(f"Unexpected fields for Project {self.operation}.")
        if self.title is not None and not self.title.strip():
            raise ValueError("Project title must not be blank.")
        return self


class ProjectResult(BaseModel):
    current: Project | None = None
    projects: list[ProjectSummary] = Field(default_factory=list[ProjectSummary])
