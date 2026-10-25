"""Turn raw pscomppars rows (live or Snapshot) into a typed System."""

import math
import re
from collections.abc import Sequence
from typing import Literal

from exoscope.catalog.fields import COMPOSITE_NOTE, PLANET_FIELDS, STAR_FIELDS, FieldSpec
from exoscope.catalog.models import (
    Measured,
    Missing,
    Planet,
    Provenance,
    Quantity,
    Reference,
    Star,
    System,
)
from exoscope.catalog.tap import Row

_HREF = re.compile(r"href=([^\s>]+)")
_LABEL = re.compile(r">([^<]*)</a>")


def _number(row: Row, column: str) -> float | None:
    value = row.get(column)
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return None if math.isnan(number) else number


def _text(row: Row, column: str) -> str | None:
    value = row.get(column)
    return value.strip() or None if isinstance(value, str) else None


def parse_reference(reflink: str | None) -> Reference | None:
    """Archive reflinks are HTML anchors; keep only their label and URL."""
    if not reflink:
        return None
    label = _LABEL.search(reflink)
    href = _HREF.search(reflink)
    text = label.group(1).strip() if label else reflink.strip()
    return Reference(label=text, url=href.group(1) if href else None)


def _limit(flag: float | None) -> Literal["upper", "lower"] | None:
    if flag == 1:
        return "upper"
    if flag == -1:
        return "lower"
    return None


def quantity(row: Row, spec: FieldSpec) -> Quantity:
    value = _number(row, spec.column)
    if value is None:
        return Missing(unit=spec.unit)
    err_hi = _number(row, f"{spec.column}err1") if spec.has_errors else None
    err2 = _number(row, f"{spec.column}err2") if spec.has_errors else None
    flag = _number(row, f"{spec.column}lim") if spec.has_limit else None
    measured = Measured(
        value=value,
        unit=spec.unit,
        err_lo=abs(err2) if err2 is not None else None,
        err_hi=err_hi,
        limit=_limit(flag),
        reference=parse_reference(_text(row, spec.reflink_column or "")),
    )
    return _apply_quirks(spec, measured)


def _apply_quirks(spec: FieldSpec, m: Measured) -> Measured:
    if spec.column == "pl_orblper":
        return m.model_copy(update={"value": m.value % 360})
    if spec.column == "st_lum":
        return _linear_luminosity(m)
    return m


def _linear_luminosity(m: Measured) -> Measured:
    """st_lum is log10(L/Lsun); report L/Lsun with asymmetric errors propagated."""
    linear = 10**m.value
    hi = 10 ** (m.value + m.err_hi) - linear if m.err_hi is not None else None
    lo = linear - 10 ** (m.value - m.err_lo) if m.err_lo is not None else None
    note = "Converted from the archive's log10(L/Lsun) value."
    return m.model_copy(update={"value": linear, "err_hi": hi, "err_lo": lo, "note": note})


def _planet(row: Row) -> Planet:
    values = {spec.attr: quantity(row, spec) for spec in PLANET_FIELDS}
    provenance = _text(row, "pl_bmassprov")
    mass = values["mass"]
    if isinstance(mass, Measured) and provenance and provenance != "Mass":
        values["mass"] = mass.model_copy(update={"note": f"Mass provenance: {provenance}."})
    return Planet(
        name=_text(row, "pl_name") or "",
        letter=_text(row, "pl_letter"),
        mass_provenance=provenance,
        **values,
    )


def _star(row: Row, hostname: str) -> Star:
    values = {spec.attr: quantity(row, spec) for spec in STAR_FIELDS}
    return Star(hostname=hostname, **values)


def build_system(rows: Sequence[Row], provenance: Provenance) -> System:
    """All rows must share one hostname; the star is read from the first row."""
    hostname = _text(rows[0], "hostname") or ""
    planets = sorted((_planet(r) for r in rows), key=lambda p: (p.letter or "", p.name))
    return System(
        hostname=hostname,
        star=_star(rows[0], hostname),
        planets=planets,
        provenance=provenance,
        notes=[COMPOSITE_NOTE],
    )
