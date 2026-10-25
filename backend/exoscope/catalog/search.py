"""search_catalog: a model-free tool. Live first; the population Snapshot only when TAP fails."""

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime

from exoscope.catalog.errors import CatalogUnavailableError, InvalidSearchError
from exoscope.catalog.fields import COMPOSITE_NOTE, SOURCE, TABLE
from exoscope.catalog.models import LiveProvenance, Provenance, SnapshotProvenance
from exoscope.catalog.population import Population, load_population
from exoscope.catalog.sample_models import Filter, Interpretation, Sample, Sort
from exoscope.catalog.sample_parse import exclusion, interpretations_with_caveats, sample_planet
from exoscope.catalog.search_fields import (
    DEFAULT_RESULT_FIELDS,
    SearchField,
    columns_for,
    field,
)
from exoscope.catalog.search_query import (
    Condition,
    candidates_where,
    condition,
    dependent_fields,
    lacks_only_values,
    match_where,
    sort_field,
)
from exoscope.catalog.tap import LimitedTapQuery, Row, query_tap

MAX_LIMIT = 500
DEFAULT_LIMIT = 100
MAX_FILTERS = 10

Clock = Callable[[], datetime]


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class Plan:
    conditions: list[Condition]
    sort: SearchField | None
    descending: bool
    shown: list[SearchField]
    deps: list[SearchField]
    limit: int


@dataclass(frozen=True)
class Result:
    rows: list[Row]
    matched: int
    excluded: list[Row] | None = None
    """None when the live exclusion query failed; counted from the Snapshot instead."""


def search_catalog(  # noqa: PLR0913 — the tool's public signature
    filters: list[Filter],
    interpretations: list[Interpretation] | None = None,
    sort: Sort | None = None,
    limit: int = DEFAULT_LIMIT,
    *,
    fields: list[str] | None = None,
    tap: LimitedTapQuery = query_tap,
    clock: Clock = _now,
    population: Callable[[], Population] = load_population,
) -> Sample:
    """Select a Sample by explicit filters. Invalid searches raise before any query runs."""
    plan = _plan(filters, sort, limit, fields)
    provenance: Provenance
    notes = [COMPOSITE_NOTE]
    try:
        result = _live(plan, tap)
        provenance = LiveProvenance(source=SOURCE, fetched_at=clock())
    except CatalogUnavailableError:
        snapshot = population()
        result = _offline(plan, snapshot)
        provenance = SnapshotProvenance(source=SOURCE, snapshot_date=snapshot.snapshot_date)
    excluded = result.excluded
    if excluded is None:
        snapshot = population()
        excluded = _offline_excluded(plan, snapshot)
        notes.append(
            "The archive rejected the exclusion query, so excluded planets were counted from "
            f"the Snapshot of {snapshot.snapshot_date.isoformat()}."
        )
    return Sample(
        filters=[c.as_filter() for c in plan.conditions],
        interpretations=interpretations_with_caveats(interpretations or []),
        sort=Sort(field=plan.sort.name, direction=sort.direction) if plan.sort and sort else None,
        limit=plan.limit,
        fields=[f.as_sample_field() for f in plan.shown],
        planets=[sample_planet(r, plan.shown) for r in result.rows],
        matched=result.matched,
        truncated=result.matched > len(result.rows),
        excluded=exclusion(excluded, plan.deps),
        provenance=provenance,
        notes=notes,
    )


def _plan(filters: list[Filter], sort: Sort | None, limit: int, fields: list[str] | None) -> Plan:
    if not 1 <= limit <= MAX_LIMIT:
        raise InvalidSearchError(f"limit must be between 1 and {MAX_LIMIT}, got {limit}.")
    if len(filters) > MAX_FILTERS:
        raise InvalidSearchError(f"At most {MAX_FILTERS} filters, got {len(filters)}.")
    conditions = [condition(f) for f in filters]
    sort_spec = sort_field(sort)
    shown = {f.name: f for f in (field(n) for n in (fields or DEFAULT_RESULT_FIELDS))}
    for extra in [c.field for c in conditions] + ([sort_spec] if sort_spec else []):
        shown.setdefault(extra.name, extra)
    return Plan(
        conditions=conditions,
        sort=sort_spec,
        descending=sort is not None and sort.direction == "desc",
        shown=list(shown.values()),
        deps=dependent_fields(conditions, sort_spec),
        limit=limit,
    )


def _where(clause: str) -> str:
    return f" where {clause}" if clause else ""


def _live(plan: Plan, tap: LimitedTapQuery) -> Result:
    where = _where(match_where(plan.conditions, plan.sort))
    order = f"{plan.sort.column} {'desc' if plan.descending else 'asc'}, " if plan.sort else ""
    rows_q = (
        f"select {','.join(columns_for(plan.shown))} from {TABLE}{where} order by {order}pl_name"
    )
    count_q = f"select count(*) as n from {TABLE}{where}"
    with ThreadPoolExecutor(max_workers=3) as pool:
        rows = pool.submit(tap, rows_q, plan.limit)
        count = pool.submit(tap, count_q)
        excluded = pool.submit(_live_excluded, plan, tap) if plan.deps else None
        return Result(
            rows=rows.result(),
            matched=_count(count.result()),
            excluded=_unless_unavailable(excluded.result) if excluded else [],
        )


def _live_excluded(plan: Plan, tap: LimitedTapQuery) -> list[Row]:
    cols = {"pl_name": None} | {f.column: None for f in (*_fields(plan.conditions), *plan.deps)}
    where = _where(candidates_where(plan.conditions))
    candidates = tap(f"select {','.join(cols)} from {TABLE}{where}")
    return [r for r in candidates if lacks_only_values(r, plan.conditions, plan.deps)]


def _fields(conditions: list[Condition]) -> list[SearchField]:
    return [c.field for c in conditions]


def _unless_unavailable(fetch: Callable[[], list[Row]]) -> list[Row] | None:
    """The exclusion count is secondary: if only its query fails, count from the Snapshot."""
    try:
        return fetch()
    except CatalogUnavailableError:
        return None


def _count(rows: list[Row]) -> int:
    count = rows[0].get("n") if rows else None
    if not isinstance(count, int):
        raise CatalogUnavailableError("NASA archive returned an unexpected count.")
    return count


def _offline(plan: Plan, snapshot: Population) -> Result:
    """Same meaning as the ADQL in _live, evaluated over the population Snapshot."""
    matched: list[Row] = [r for r in snapshot.rows if _matches(r, plan)]
    if plan.sort is not None:
        col = plan.sort.column
        matched.sort(key=lambda r: str(r.get("pl_name")))
        matched.sort(key=lambda r: _sort_key(r.get(col)), reverse=plan.descending)
    else:
        matched.sort(key=lambda r: str(r.get("pl_name")))
    return Result(
        rows=matched[: plan.limit], matched=len(matched), excluded=_offline_excluded(plan, snapshot)
    )


def _matches(row: Row, plan: Plan) -> bool:
    if plan.sort is not None and row.get(plan.sort.column) is None:
        return False
    return all(c.holds(row) is True for c in plan.conditions)


def _offline_excluded(plan: Plan, snapshot: Population) -> list[Row]:
    return [r for r in snapshot.rows if lacks_only_values(r, plan.conditions, plan.deps)]


def _sort_key(value: object) -> float:
    return float(value) if isinstance(value, int | float) else 0.0
