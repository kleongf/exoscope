"""Validated Sample search conditions, as ADQL and as Python predicates with the same meaning.

Only allowlisted columns, enumerated operators, validated numbers and enumerated discovery
methods ever reach ADQL. A comparison on a missing value is never true: missing is not zero.
"""

import math
from dataclasses import dataclass
from typing import cast

from exoscope.catalog.errors import InvalidSearchError
from exoscope.catalog.sample_models import Filter, Operator, Sort
from exoscope.catalog.search_fields import DISCOVERY_METHODS, SearchField, field
from exoscope.catalog.tap import Row

COMPARISONS = ("<", "<=", ">", ">=", "=")
OPERATORS = (*COMPARISONS, "between", "is_null")
TEXT_OPERATORS = ("=", "is_null")

FilterValue = float | str


@dataclass(frozen=True)
class Condition:
    field: SearchField
    op: Operator
    value: FilterValue | None = None
    upper: float | None = None

    @property
    def needs_value(self) -> bool:
        """True when a missing value makes the condition unknowable rather than satisfied."""
        return self.op != "is_null"

    def adql(self) -> str:
        col = self.field.column
        if self.op == "is_null":
            return f"{col} is null"
        if self.op == "between":
            return f"{col} between {_lit(self.value)} and {_lit(self.upper)}"
        return f"{col} {self.op} {_lit(self.value)}"

    def coalesced_adql(self) -> str:
        """The condition with a missing value treated as passing.

        Used to find planets excluded only for missing values. It avoids `or` and `is null`
        clauses, which the archive's firewall rejects in some combinations.
        """
        col = self.field.column
        if isinstance(self.value, str):
            return f"coalesce({col}, {_lit(self.value)}) = {_lit(self.value)}"
        low = cast(float, self.value)
        stand_in = {"<": low - 1, ">": low + 1}.get(self.op, low)
        passing = Condition(self.field, self.op, self.value, self.upper).adql()
        return passing.replace(col, f"coalesce({col}, {_lit(stand_in)})", 1)

    def holds(self, row: Row) -> bool | None:
        """Python twin of adql(): None when the row lacks the value the condition needs."""
        raw = row.get(self.field.column)
        if self.op == "is_null":
            return raw is None
        if raw is None:
            return None
        if isinstance(self.value, str):
            return raw == self.value
        return _compare(_as_float(raw), self.op, cast(float, self.value), self.upper)

    def as_filter(self) -> Filter:
        return Filter(field=self.field.name, op=self.op, value=self.value, upper=self.upper)


def _compare(x: float, op: Operator, value: float, upper: float | None) -> bool:
    if op == "between":
        return value <= x <= cast(float, upper)
    return {
        "<": x < value,
        "<=": x <= value,
        ">": x > value,
        ">=": x >= value,
        "=": x == value,
    }[op]


def _as_float(raw: object) -> float:
    return float(cast(float, raw))


def _lit(value: FilterValue | None) -> str:
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return repr(float(cast(float, value)))


def _number(value: object, what: str) -> float:
    if isinstance(value, bool) or value is None:
        raise InvalidSearchError(f"{what} needs a number, got {value!r}.")
    try:
        number = float(cast(float | str, value))
    except ValueError as exc:
        raise InvalidSearchError(f"{what} needs a number, got {value!r}.") from exc
    if not math.isfinite(number):
        raise InvalidSearchError(f"{what} needs a finite number, got {value!r}.")
    return number


def _method(value: object) -> str:
    text = str(value).strip().lower() if value is not None else ""
    for method in DISCOVERY_METHODS:
        if method.lower() == text:
            return method
    raise InvalidSearchError(
        f"{value!r} is not a discovery method. Allowed: {', '.join(DISCOVERY_METHODS)}."
    )


def condition(f: Filter) -> Condition:
    """Validate one Filter against the allowlist; raise InvalidSearchError on anything else."""
    spec = field(f.field)
    if f.op not in OPERATORS:
        raise InvalidSearchError(f"{f.op!r} is not an operator. Allowed: {', '.join(OPERATORS)}.")
    op = f.op
    what = f"{spec.name} {op}"
    if op == "is_null":
        if f.value is not None or f.upper is not None:
            raise InvalidSearchError(f"{what} takes no value.")
        return Condition(spec, op)
    if spec.kind == "text":
        if op not in TEXT_OPERATORS:
            raise InvalidSearchError(f"{spec.name} only supports = and is_null.")
        return Condition(spec, op, _method(f.value))
    low = _number(f.value, what)
    if op != "between":
        if f.upper is not None:
            raise InvalidSearchError(f"{what} takes one value; upper is only for between.")
        return Condition(spec, op, low)
    high = _number(f.upper, f"{what} upper bound")
    if low > high:
        raise InvalidSearchError(f"{what}: lower bound {low} is above upper bound {high}.")
    return Condition(spec, op, low, high)


def sort_field(sort: Sort | None) -> SearchField | None:
    if sort is None:
        return None
    spec = field(sort.field)
    if spec.kind != "number":
        raise InvalidSearchError(f"Sorting is only possible on numeric fields, not {spec.name}.")
    return spec


def dependent_fields(conditions: list[Condition], sort: SearchField | None) -> list[SearchField]:
    """Fields a planet must have a value for to be judged by this search."""
    deps = [c.field for c in conditions if c.needs_value]
    if sort is not None:
        deps.append(sort)
    unique: dict[str, SearchField] = {f.name: f for f in deps}
    return list(unique.values())


def match_where(conditions: list[Condition], sort: SearchField | None) -> str:
    parts = [c.adql() for c in conditions]
    if sort is not None:
        parts.append(f"{sort.column} is not null")
    return " and ".join(parts)


def candidates_where(conditions: list[Condition]) -> str:
    """Planets passing every comparison they can be judged on; missing values pass."""
    return " and ".join(c.coalesced_adql() for c in conditions if c.needs_value)


def lacks_only_values(row: Row, conditions: list[Condition], deps: list[SearchField]) -> bool:
    """True when the row fails the search only because a dependent value is missing."""
    if any(c.holds(row) is False for c in conditions):
        return False
    return any(row.get(d.column) is None for d in deps)
