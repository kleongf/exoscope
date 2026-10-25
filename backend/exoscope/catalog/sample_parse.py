"""Turn raw pscomppars rows into Sample values, exclusions and caveated Interpretations."""

from exoscope.catalog.errors import InvalidSearchError
from exoscope.catalog.models import Measured, Missing
from exoscope.catalog.parse import parse_reference, quantity
from exoscope.catalog.sample_models import (
    Exclusion,
    Interpretation,
    SamplePlanet,
    SampleValue,
    TextValue,
)
from exoscope.catalog.search_fields import SearchField
from exoscope.catalog.tap import Row

MAX_INTERPRETATIONS = 10
LOADED_TERMS = (
    "earth-like",
    "earthlike",
    "habitable",
    "potentially habitable",
    "rocky",
    "water",
    "liquid water",
    "ocean",
    "oceans",
    "life",
    "alive",
    "earth twin",
    "goldilocks",
)
LOADED_CAVEAT = (
    "Proxy only: catalog values cannot establish this; they say nothing about atmosphere, "
    "surface or composition."
)
EXCLUSION_REASON = (
    "These planets pass every condition they can be judged on, but the archive has no value "
    "for at least one field this search depends on. Missing values are not treated as zero."
)


def _text(row: Row, column: str) -> str | None:
    value = row.get(column)
    return value.strip() or None if isinstance(value, str) else None


def _value(row: Row, spec: SearchField) -> SampleValue:
    if spec.kind == "text":
        text = _text(row, spec.column)
        if text is None:
            return Missing(unit=spec.unit)
        reference = parse_reference(_text(row, spec.spec.reflink_column or ""))
        return TextValue(value=text, reference=reference)
    value = quantity(row, spec.spec)
    provenance = _text(row, "pl_bmassprov")
    if spec.name == "mass" and isinstance(value, Measured) and provenance not in (None, "Mass"):
        return value.model_copy(update={"note": f"Mass provenance: {provenance}."})
    return value


def sample_planet(row: Row, shown: list[SearchField]) -> SamplePlanet:
    return SamplePlanet(
        name=_text(row, "pl_name") or "",
        hostname=_text(row, "hostname") or "",
        values={spec.name: _value(row, spec) for spec in shown},
    )


def exclusion(rows: list[Row], deps: list[SearchField]) -> Exclusion:
    by_field = {d.name: sum(1 for r in rows if r.get(d.column) is None) for d in deps}
    return Exclusion(
        count=len(rows),
        by_field={k: v for k, v in by_field.items() if v},
        reason=EXCLUSION_REASON if rows else "No planets were excluded for missing values.",
    )


def _is_loaded(term: str) -> bool:
    key = " ".join(term.lower().replace("_", " ").split())
    return key in LOADED_TERMS or any(t in key for t in ("habitab", "earth-like", "earthlike"))


def interpretations_with_caveats(items: list[Interpretation]) -> list[Interpretation]:
    """Validate Interpretations; a loaded word always carries a caveat, added if absent."""
    if len(items) > MAX_INTERPRETATIONS:
        raise InvalidSearchError(f"At most {MAX_INTERPRETATIONS} interpretations.")
    out: list[Interpretation] = []
    for item in items:
        if not item.term.strip() or not item.meaning.strip():
            raise InvalidSearchError("Each interpretation needs a term and what it was read as.")
        if _is_loaded(item.term) and not (item.caveat and item.caveat.strip()):
            item = item.model_copy(update={"caveat": LOADED_CAVEAT})
        out.append(item)
    return out
