"""Web evidence remains distinct from archive data and scene commands."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class WebSource(BaseModel):
    id: str
    kind: Literal["web_source"] = "web_source"
    title: str
    url: str
    retrieved_at: datetime
    domain: str


class WebSupport(BaseModel):
    text: str
    source_ids: list[str] = Field(default_factory=list[str])


class WebSearchResult(BaseModel):
    status: Literal["ok", "unavailable"]
    query: str
    grounded_text: str = ""
    sources: list[WebSource] = Field(default_factory=list[WebSource])
    supports: list[WebSupport] = Field(default_factory=list[WebSupport])
    search_suggestions_html: str | None = None
    error: str | None = None
