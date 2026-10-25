"""Typed System records. Every value carries its unit and source, or is explicitly missing."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class Reference(BaseModel):
    """The publication a catalog value comes from."""

    label: str
    url: str | None


class Measured(BaseModel):
    status: Literal["measured"] = "measured"
    value: float
    unit: str | None
    err_lo: float | None = Field(description="Size of the lower uncertainty (positive)")
    err_hi: float | None = Field(description="Size of the upper uncertainty (positive)")
    limit: Literal["upper", "lower"] | None = Field(
        description="Set when the value is a limit rather than a measurement"
    )
    reference: Reference | None
    note: str | None = None


class Missing(BaseModel):
    status: Literal["missing"] = "missing"
    unit: str | None


Quantity = Annotated[Measured | Missing, Field(discriminator="status")]


class Star(BaseModel):
    hostname: str
    effective_temperature: Quantity
    radius: Quantity
    mass: Quantity
    luminosity: Quantity
    distance: Quantity
    ra: Quantity
    dec: Quantity


class Planet(BaseModel):
    name: str = Field(description="Canonical archive pl_name; the planet's ID")
    letter: str | None
    orbital_period: Quantity
    semi_major_axis: Quantity
    radius: Quantity
    mass: Quantity
    mass_provenance: str | None = Field(description="Archive pl_bmassprov, e.g. Mass or Msini")
    insolation: Quantity
    equilibrium_temperature: Quantity
    eccentricity: Quantity
    inclination: Quantity
    transit_midpoint: Quantity
    argument_of_periastron: Quantity


class LiveProvenance(BaseModel):
    mode: Literal["live"] = "live"
    source: str
    fetched_at: datetime


class SnapshotProvenance(BaseModel):
    mode: Literal["snapshot"] = "snapshot"
    source: str
    snapshot_date: date


Provenance = Annotated[LiveProvenance | SnapshotProvenance, Field(discriminator="mode")]


class System(BaseModel):
    """One host star and its known planets."""

    hostname: str = Field(description="Canonical archive hostname; the System's ID")
    star: Star
    planets: list[Planet]
    provenance: Provenance
    notes: list[str]
