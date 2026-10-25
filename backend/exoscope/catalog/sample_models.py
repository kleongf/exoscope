"""Typed Sample search inputs and results. Values reuse the System's Measured/Missing shapes."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from exoscope.catalog.models import Measured, Missing, Provenance, Reference

Operator = Literal["<", "<=", ">", ">=", "=", "between", "is_null"]


class Filter(BaseModel):
    """One explicit condition on an allowlisted field."""

    field: str = Field(description="Allowlisted field name, e.g. radius or orbital_period")
    op: str = Field(description="One of < <= > >= = between is_null")
    value: float | str | None = Field(
        default=None, description="Number to compare with (lower bound for between); text for ="
    )
    upper: float | None = Field(default=None, description="Upper bound, only for between")


class Interpretation(BaseModel):
    """How a vague word in the student's request was read as a concrete filter."""

    model_config = ConfigDict(
        validate_by_name=True, validate_by_alias=True, serialize_by_alias=True
    )

    term: str = Field(description="The student's word, e.g. small")
    meaning: str = Field(alias="as", description="How it was read, e.g. radius < 2 Earth radii")
    caveat: str | None = Field(
        default=None, description="Required for loaded words such as Earth-like or habitable"
    )


class Sort(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "asc"


class TextValue(BaseModel):
    status: Literal["text"] = "text"
    value: str
    reference: Reference | None


SampleValue = Annotated[Measured | Missing | TextValue, Field(discriminator="status")]


class SampleField(BaseModel):
    name: str
    label: str
    unit: str | None


class SamplePlanet(BaseModel):
    name: str = Field(description="Canonical archive pl_name; the planet's ID")
    hostname: str = Field(description="Canonical archive hostname of its System")
    values: dict[str, SampleValue]


class Exclusion(BaseModel):
    """Planets that pass every known condition but lack a value the search depends on."""

    count: int
    by_field: dict[str, int] = Field(description="Excluded planets missing each field")
    reason: str


class Sample(BaseModel):
    """A set of planets selected by explicit, visible filters. Missing is never treated as zero."""

    filters: list[Filter]
    interpretations: list[Interpretation]
    sort: Sort | None
    limit: int
    fields: list[SampleField]
    planets: list[SamplePlanet]
    matched: int = Field(description="All planets matching the filters, before the limit")
    truncated: bool
    excluded: Exclusion
    provenance: Provenance
    notes: list[str]
