"""Scene commands sent to the frontend. Every command is validated here before it leaves."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class FocusPlanet(BaseModel):
    kind: Literal["focus_planet"] = "focus_planet"
    planet_id: str = Field(description="Archive pl_name, e.g. 'TRAPPIST-1 e'.")


class SetTimeScale(BaseModel):
    kind: Literal["set_time_scale"] = "set_time_scale"
    days_per_second: float = Field(ge=0, le=1000)


UiCommand = Annotated[FocusPlanet | SetTimeScale, Field(discriminator="kind")]
