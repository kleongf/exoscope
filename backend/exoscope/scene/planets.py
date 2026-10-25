"""Resolve a spoken or typed planet reference against the System actually open."""

import re

from exoscope.catalog import System


class SceneError(Exception):
    """A scene request that cannot be applied honestly. The message is shown to the student."""


def _key(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def resolve_planet(system: System | None, reference: str) -> str:
    """Return the canonical pl_name for "TRAPPIST-1 e", "planet e" or "e"; never a guess."""
    if system is None:
        raise SceneError("No System is open, so there is no planet to focus on.")
    wanted = _key(reference)
    bare = _key(re.sub(r"^\s*planet\s+", "", reference, flags=re.IGNORECASE))
    for planet in system.planets:
        letter = _key(planet.letter or planet.name.rsplit(" ", 1)[-1])
        if wanted == _key(planet.name) or bare == letter:
            return planet.name
    names = ", ".join(planet.name for planet in system.planets)
    raise SceneError(f"{system.hostname} has no planet '{reference}'. Its planets are: {names}.")
