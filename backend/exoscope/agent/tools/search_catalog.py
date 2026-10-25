"""search_catalog: select a Sample of planets across Systems by explicit, visible filters."""

from pydantic import BaseModel, ConfigDict, Field

from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import Tool, ToolOutput
from exoscope.catalog import Filter, Interpretation, Sample, Sort, search_catalog
from exoscope.catalog.models import Measured
from exoscope.catalog.sample_models import SampleValue
from exoscope.catalog.search_fields import SEARCH_FIELDS

BRIEF_PLANETS = 15
"""How many planets Gemma sees; the full Sample goes to the table and chart."""


class SearchArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")
    filters: list[Filter] = Field(
        min_length=1,
        max_length=10,
        description=f"Explicit conditions. Fields: {', '.join(SEARCH_FIELDS)}.",
    )
    interpretations: list[Interpretation] = Field(
        default_factory=list[Interpretation],
        max_length=10,
        description="One entry per vague word in the request and how it was read as a filter.",
    )
    sort: Sort | None = None
    limit: int = Field(default=100, ge=1, le=500)


def _brief(value: SampleValue) -> object:
    if isinstance(value, Measured):
        return value.value if value.limit is None else {"value": value.value, "limit": value.limit}
    return value.value if value.status == "text" else "missing"


def _payload(sample: Sample) -> dict[str, object]:
    """Compact on purpose: Gemma gets counts and a few rows; sources stay in TurnData."""
    return {
        "matched": sample.matched,
        "shown": len(sample.planets),
        "truncated": sample.truncated,
        "excluded": sample.excluded.model_dump(),
        "interpretations": [i.model_dump(by_alias=True) for i in sample.interpretations],
        "units": {f.name: f.unit for f in sample.fields},
        "first_planets": [
            {"planet": p.name, **{k: _brief(v) for k, v in p.values.items()}}
            for p in sample.planets[:BRIEF_PLANETS]
        ],
        "provenance": sample.provenance.mode,
    }


def _run(arguments: SearchArguments, result: AgentResult) -> ToolOutput:
    sample = search_catalog(
        arguments.filters, arguments.interpretations, arguments.sort, arguments.limit
    )
    result.data.sample = sample
    if sample.provenance.mode == "snapshot":
        result.warn("Live archive unavailable; using dated Snapshot data.")
    shown = f"showing {len(sample.planets)}" if sample.truncated else "all shown"
    detail = (
        f"Found {sample.matched} planets ({shown}); "
        f"{sample.excluded.count} excluded for missing values."
    )
    return ToolOutput({"sample": _payload(sample)}, detail)


SEARCH_CATALOG = Tool(
    name="search_catalog",
    description=(
        "Search the whole archive for a Sample of planets across many Systems using explicit "
        "filters on allowlisted fields. Record every vague word (small, hot, close, Earth-like) "
        "as an interpretation. Planets missing a filtered value are excluded and counted."
    ),
    arguments=SearchArguments,
    run=_run,
)
