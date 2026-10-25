"""Scene commands sent to the frontend. Every command is validated here before it leaves."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from exoscope.catalog import System


class FocusPlanet(BaseModel):
    kind: Literal["focus_planet"] = "focus_planet"
    name: str = Field(description="Archive pl_name, e.g. 'TRAPPIST-1 e'.")


class SetTimeScale(BaseModel):
    kind: Literal["set_time_scale"] = "set_time_scale"
    days_per_second: float = Field(ge=0, le=1000)


class LoadSystem(BaseModel):
    kind: Literal["load_system"] = "load_system"
    system: System


UiCommand = Annotated[FocusPlanet | SetTimeScale | LoadSystem, Field(discriminator="kind")]
