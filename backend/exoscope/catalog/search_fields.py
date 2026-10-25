"""The allowlist of fields a Sample search may filter, sort or show. The only place they live."""

from dataclasses import dataclass
from typing import Literal

from exoscope.catalog.errors import UnknownFieldError
from exoscope.catalog.fields import FieldSpec
from exoscope.catalog.sample_models import SampleField

FieldKind = Literal["number", "text"]

DISCOVERY_METHODS = (
    "Astrometry",
    "Disk Kinematics",
    "Eclipse Timing Variations",
    "Imaging",
    "Microlensing",
    "Orbital Brightness Modulation",
    "Pulsar Timing",
    "Pulsation Timing Variations",
    "Radial Velocity",
    "Transit",
    "Transit Timing Variations",
)


@dataclass(frozen=True)
class SearchField:
    name: str
    label: str
    kind: FieldKind
    spec: FieldSpec

    @property
    def column(self) -> str:
        return self.spec.column

    @property
    def unit(self) -> str | None:
        return self.spec.unit

    def as_sample_field(self) -> SampleField:
        return SampleField(name=self.name, label=self.label, unit=self.unit)


def _num(
    name: str, label: str, column: str, unit: str | None, *, has_limit: bool = True
) -> SearchField:
    return SearchField(name, label, "number", FieldSpec(name, column, unit, has_limit=has_limit))


def _disc(name: str, column: str, unit: str | None) -> FieldSpec:
    """Discovery fields have no uncertainties or limits; their source is the discovery paper."""
    return FieldSpec(name, column, unit, has_errors=False, has_limit=False, reflink="disc_refname")


SEARCH_FIELDS: dict[str, SearchField] = {
    f.name: f
    for f in (
        _num("radius", "Planet radius", "pl_rade", "Earth radii"),
        _num("mass", "Planet mass", "pl_bmasse", "Earth masses"),
        _num("orbital_period", "Orbital period", "pl_orbper", "day"),
        _num("semi_major_axis", "Semi-major axis", "pl_orbsmax", "AU"),
        _num("eccentricity", "Eccentricity", "pl_orbeccen", None),
        _num("insolation", "Insolation", "pl_insol", "Earth flux"),
        _num("equilibrium_temperature", "Equilibrium temperature", "pl_eqt", "K"),
        SearchField(
            "discovery_year",
            "Discovery year",
            "number",
            _disc("discovery_year", "disc_year", "year"),
        ),
        SearchField(
            "discovery_method",
            "Discovery method",
            "text",
            _disc("discovery_method", "discoverymethod", None),
        ),
        _num("star_temperature", "Star effective temperature", "st_teff", "K"),
        _num("star_radius", "Star radius", "st_rad", "Solar radii"),
        _num("star_mass", "Star mass", "st_mass", "Solar masses"),
        _num("distance", "Distance from the Sun", "sy_dist", "pc", has_limit=False),
    )
}

ALIASES = {
    "planet_radius": "radius",
    "planet_mass": "mass",
    "period": "orbital_period",
    "a": "semi_major_axis",
    "orbital_distance": "semi_major_axis",
    "irradiation": "insolation",
    "stellar_irradiation": "insolation",
    "instellation": "insolation",
    "temperature": "equilibrium_temperature",
    "teff": "star_temperature",
    "stellar_temperature": "star_temperature",
    "stellar_radius": "star_radius",
    "stellar_mass": "star_mass",
    "method": "discovery_method",
    "year": "discovery_year",
}

DEFAULT_RESULT_FIELDS = (
    "radius",
    "mass",
    "orbital_period",
    "insolation",
    "equilibrium_temperature",
    "distance",
    "discovery_method",
)

ID_COLUMNS = ("hostname", "pl_name", "pl_bmassprov")


def field(name: str) -> SearchField:
    """Look up an allowlisted field by name or alias, case- and spacing-insensitively."""
    key = name.strip().lower().replace("-", "_").replace(" ", "_")
    found = SEARCH_FIELDS.get(ALIASES.get(key, key))
    if found is None:
        raise UnknownFieldError(name, sorted(SEARCH_FIELDS))
    return found


def columns_for(fields: list[SearchField]) -> list[str]:
    cols: list[str] = list(ID_COLUMNS)
    for f in fields:
        cols += [c for c in f.spec.columns() if c not in cols]
    return cols


def population_columns() -> list[str]:
    return columns_for(list(SEARCH_FIELDS.values()))
