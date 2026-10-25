"""Scene commands sent to the frontend. Every command is validated here before it leaves."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from exoscope.catalog import System

ColorBy = Literal["none", "insolation", "radius", "equilibrium_temperature"]
MAX_DAYS_PER_SECOND = 1000


class FocusPlanet(BaseModel):
    kind: Literal["focus_planet"] = "focus_planet"
    name: str = Field(description="Archive pl_name, e.g. 'TRAPPIST-1 e'.")


class SetTimeScale(BaseModel):
    """Simulated days per real second; 0 pauses time."""

    kind: Literal["set_time_scale"] = "set_time_scale"
    days_per_second: float = Field(ge=0, le=MAX_DAYS_PER_SECOND)


class SetLabels(BaseModel):
    kind: Literal["set_labels"] = "set_labels"
    visible: bool


class SetColorBy(BaseModel):
    """Colour planets by one archive property, with a legend; "none" restores fixed colours."""

    kind: Literal["set_color_by"] = "set_color_by"
    property: ColorBy


class LoadSystem(BaseModel):
    kind: Literal["load_system"] = "load_system"
    system: System


UiCommand = Annotated[
    FocusPlanet | SetTimeScale | SetLabels | SetColorBy | LoadSystem,
    Field(discriminator="kind"),
]
