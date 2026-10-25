"""compare: a model-free tool aligning two allowlisted properties across planets."""

from collections.abc import Sequence
from typing import get_args

from exoscope.catalog.fields import COMPOSITE_NOTE, PLANET_FIELDS
from exoscope.catalog.models import Measured, Planet, Quantity, System
from exoscope.compare.errors import NothingToCompareError, UnknownPlanetError, UnknownPropertyError
from exoscope.compare.models import (
    Axis,
    CompareProperty,
    Comparison,
    ComparisonRow,
    Exclusion,
    SystemProvenance,
)

ALLOWED: tuple[CompareProperty, ...] = get_args(CompareProperty)

LABELS: dict[CompareProperty, str] = {
    "orbital_period": "Orbital period",
    "semi_major_axis": "Semi-major axis",
    "radius": "Planet radius",
    "mass": "Planet mass",
    "insolation": "Insolation",
    "equilibrium_temperature": "Equilibrium temperature",
    "eccentricity": "Eccentricity",
}

_UNITS = {spec.attr: spec.unit for spec in PLANET_FIELDS}


def compare(
    systems: System | Sequence[System],
    x: str,
    y: str,
    planets: Sequence[str] | None = None,
) -> Comparison:
    """Align `x` and `y` for the chosen planets (all planets of `systems` when None).

    Missing values and limits are excluded with a reason, never plotted as zero.
    """
    loaded = [systems] if isinstance(systems, System) else list(systems)
    x_axis, y_axis = _axis(x), _axis(y)
    chosen = _choose(loaded, planets)
    rows = [_row(host, planet, x_axis.property, y_axis.property) for host, planet in chosen]
    hosts = {host for host, _ in chosen}
    return Comparison(
        x=x_axis,
        y=y_axis,
        rows=rows,
        provenance=[
            SystemProvenance(hostname=s.hostname, provenance=s.provenance)
            for s in loaded
            if s.hostname in hosts
        ],
        notes=[COMPOSITE_NOTE],
    )


def _axis(name: str) -> Axis:
    for prop in ALLOWED:
        if prop == name:
            return Axis(property=prop, label=LABELS[prop], unit=_UNITS[prop])
    raise UnknownPropertyError(name, list(ALLOWED))


def _choose(loaded: list[System], names: Sequence[str] | None) -> list[tuple[str, Planet]]:
    every = [(s.hostname, p) for s in loaded for p in s.planets]
    if names is None:
        chosen = every
    else:
        by_name = {p.name: (host, p) for host, p in every}
        unknown = [n for n in names if n not in by_name]
        if unknown:
            raise UnknownPlanetError(unknown)
        chosen = [by_name[n] for n in dict.fromkeys(names)]
    if not chosen:
        raise NothingToCompareError()
    return chosen


def _row(host: str, planet: Planet, x: CompareProperty, y: CompareProperty) -> ComparisonRow:
    xq: Quantity = getattr(planet, x)
    yq: Quantity = getattr(planet, y)
    return ComparisonRow(planet=planet.name, hostname=host, x=xq, y=yq, excluded=_exclusion(xq, yq))


def _exclusion(xq: Quantity, yq: Quantity) -> Exclusion | None:
    x_ok, y_ok = isinstance(xq, Measured), isinstance(yq, Measured)
    if not x_ok and not y_ok:
        return "missing_both"
    if not x_ok:
        return "missing_x"
    if not y_ok:
        return "missing_y"
    if (isinstance(xq, Measured) and xq.limit) or (isinstance(yq, Measured) and yq.limit):
        return "limit_only"
    return None
