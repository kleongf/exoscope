"""Which pscomppars columns feed which System fields, with their units."""

from dataclasses import dataclass

TABLE = "pscomppars"
SOURCE = "NASA Exoplanet Archive (pscomppars)"
COMPOSITE_NOTE = (
    "pscomppars combines values from different publications; they may not be mutually consistent."
)


@dataclass(frozen=True)
class FieldSpec:
    attr: str
    column: str
    unit: str | None
    has_errors: bool = True
    has_limit: bool = True
    reflink: str | None = "default"

    @property
    def reflink_column(self) -> str | None:
        return f"{self.column}_reflink" if self.reflink == "default" else self.reflink

    def columns(self) -> list[str]:
        cols = [self.column]
        if self.has_errors:
            cols += [f"{self.column}err1", f"{self.column}err2"]
        if self.has_limit:
            cols.append(f"{self.column}lim")
        if self.reflink_column:
            cols.append(self.reflink_column)
        return cols


PLANET_FIELDS = (
    FieldSpec("orbital_period", "pl_orbper", "day"),
    FieldSpec("semi_major_axis", "pl_orbsmax", "AU"),
    FieldSpec("radius", "pl_rade", "Earth radii"),
    FieldSpec("mass", "pl_bmasse", "Earth masses"),
    FieldSpec("insolation", "pl_insol", "Earth flux"),
    FieldSpec("equilibrium_temperature", "pl_eqt", "K"),
    FieldSpec("eccentricity", "pl_orbeccen", None),
    FieldSpec("inclination", "pl_orbincl", "deg"),
    FieldSpec("transit_midpoint", "pl_tranmid", "BJD"),
    FieldSpec("argument_of_periastron", "pl_orblper", "deg"),
)

STAR_FIELDS = (
    FieldSpec("effective_temperature", "st_teff", "K"),
    FieldSpec("radius", "st_rad", "Solar radii"),
    FieldSpec("mass", "st_mass", "Solar masses"),
    # Archive stores log10(L/Lsun); the parser converts it to a linear value.
    FieldSpec("luminosity", "st_lum", "Solar luminosities"),
    FieldSpec("distance", "sy_dist", "pc", has_limit=False),
    FieldSpec("ra", "ra", "deg", has_errors=False, has_limit=False),
    FieldSpec("dec", "dec", "deg", has_errors=False, has_limit=False, reflink="ra_reflink"),
)

ID_COLUMNS = ("hostname", "pl_name", "pl_letter", "pl_bmassprov")


def select_columns() -> list[str]:
    cols: list[str] = list(ID_COLUMNS)
    for spec in (*PLANET_FIELDS, *STAR_FIELDS):
        cols += [c for c in spec.columns() if c not in cols]
    return cols
