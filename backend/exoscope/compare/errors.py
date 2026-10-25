"""Explicit comparison failures, reported to the student rather than guessed past."""


class CompareError(Exception):
    code: str = "compare_error"


class UnknownPropertyError(CompareError):
    code = "unknown_property"

    def __init__(self, name: str, allowed: list[str]) -> None:
        super().__init__(f"{name!r} cannot be compared. Allowed: {', '.join(allowed)}.")
        self.name = name
        self.allowed = allowed


class UnknownPlanetError(CompareError):
    code = "unknown_planet"

    def __init__(self, names: list[str]) -> None:
        super().__init__(f"Not in the loaded Systems: {', '.join(names)}.")
        self.names = names


class NothingToCompareError(CompareError):
    code = "nothing_to_compare"

    def __init__(self) -> None:
        super().__init__("No planets were given to compare.")
