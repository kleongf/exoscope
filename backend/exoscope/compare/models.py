"""Typed Comparisons: two properties aligned per planet, archive values only."""

from typing import Literal

from pydantic import BaseModel, Field

from exoscope.catalog.models import Provenance, Quantity

CompareProperty = Literal[
    "orbital_period",
    "semi_major_axis",
    "radius",
    "mass",
    "insolation",
    "equilibrium_temperature",
    "eccentricity",
]

Exclusion = Literal["missing_x", "missing_y", "missing_both", "limit_only"]


class Axis(BaseModel):
    property: CompareProperty
    label: str
    unit: str | None


class ComparisonRow(BaseModel):
    planet: str = Field(description="Canonical archive pl_name; links chart, table and scene")
    hostname: str
    x: Quantity
    y: Quantity
    excluded: Exclusion | None = Field(
        description="Why the planet is not plotted; None when it is plotted"
    )


class SystemProvenance(BaseModel):
    hostname: str
    provenance: Provenance


class Comparison(BaseModel):
    x: Axis
    y: Axis
    rows: list[ComparisonRow]
    provenance: list[SystemProvenance] = Field(description="Where each System's values came from")
    notes: list[str]

    @property
    def plotted(self) -> list[ComparisonRow]:
        return [r for r in self.rows if r.excluded is None]

    @property
    def excluded(self) -> list[ComparisonRow]:
        return [r for r in self.rows if r.excluded is not None]
