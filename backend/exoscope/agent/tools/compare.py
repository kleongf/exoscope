"""compare: chart two archive properties for planets of loaded Systems."""

from pydantic import BaseModel, ConfigDict, Field

from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import Tool, ToolError, ToolOutput
from exoscope.catalog import System, load_system
from exoscope.catalog.models import Measured, Quantity
from exoscope.compare import CompareError, Comparison, compare
from exoscope.compare.models import CompareProperty


class CompareArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    x: CompareProperty = Field(description="Property for the horizontal axis.")
    y: CompareProperty = Field(description="Property for the vertical axis.")
    systems: list[str] = Field(
        default_factory=list[str],
        max_length=5,
        description="Archive hostnames to include. Empty means the current System.",
    )
    planets: list[str] | None = Field(
        default=None,
        max_length=50,
        description="Canonical planet names (pl_name) to include. Omit for every planet.",
    )


def _systems(arguments: CompareArguments, result: AgentResult) -> list[System]:
    current = result.data.system
    if not arguments.systems:
        if current is None:
            raise ToolError("Open a System first, or name the Systems to compare.")
        return [current]
    loaded: dict[str, System] = {}
    for name in arguments.systems:
        system = load_system(name)  # canonicalises the name; raises CatalogError honestly
        loaded.setdefault(system.hostname, system)
    return list(loaded.values())


def _key(name: str) -> str:
    return "".join(name.upper().split())


def _canonical(names: list[str] | None, systems: list[System]) -> list[str] | None:
    """Accept planet names case- and spacing-insensitively; unknown names stay as given."""
    if names is None:
        return None
    by_key = {_key(p.name): p.name for s in systems for p in s.planets}
    return [by_key.get(_key(name), name) for name in names]


def _brief(q: Quantity) -> object:
    """A value as the model needs it: number, uncertainty and limit; sources stay in TurnData."""
    if not isinstance(q, Measured):
        return "missing"
    return {"value": q.value, "err": [q.err_lo, q.err_hi], "limit": q.limit}


def _payload(comparison: Comparison) -> dict[str, object]:
    """Compact on purpose: the full Comparison (with references) goes to the UI, not the model."""
    axis = {a: f"{getattr(comparison, a).label} ({getattr(comparison, a).unit})" for a in "xy"}
    return {
        "axes": axis,
        "rows": [
            {"planet": r.planet, "x": _brief(r.x), "y": _brief(r.y), "excluded": r.excluded}
            for r in comparison.rows
        ],
        "provenance": [f"{p.hostname}: {p.provenance.mode}" for p in comparison.provenance],
        "notes": comparison.notes,
    }


def _run(arguments: CompareArguments, result: AgentResult) -> ToolOutput:
    systems = _systems(arguments, result)
    try:
        comparison = compare(
            systems, arguments.x, arguments.y, _canonical(arguments.planets, systems)
        )
    except CompareError as exc:
        raise ToolError(str(exc)) from exc
    result.data.comparison = comparison
    if any(s.provenance.mode == "snapshot" for s in systems):
        result.warn("Live archive unavailable; using dated Snapshot data.")
    plotted, excluded = len(comparison.plotted), len(comparison.excluded)
    detail = (
        f"Compared {comparison.y.label.lower()} vs {comparison.x.label.lower()} for "
        f"{len(comparison.rows)} planets ({plotted} plotted, {excluded} excluded)."
    )
    return ToolOutput({"comparison": _payload(comparison)}, detail)


COMPARE = Tool(
    name="compare",
    description=(
        "Chart two archive properties against each other for the planets of the current "
        "System (or named Systems), with a matching table. Planets missing a value are "
        "excluded with a reason, never plotted as zero."
    ),
    arguments=CompareArguments,
    run=_run,
)
