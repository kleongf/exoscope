"""Explicit catalog failures. Callers report these; they never guess past them."""


class CatalogError(Exception):
    code: str = "catalog_error"


class UnknownSystemError(CatalogError):
    code = "unknown_system"

    def __init__(self, name: str) -> None:
        super().__init__(f"No System in the archive matches {name!r}.")
        self.name = name


class AmbiguousSystemError(CatalogError):
    code = "ambiguous_system"

    def __init__(self, name: str, candidates: list[str], total: int) -> None:
        listed = ", ".join(candidates)
        more = f" and {total - len(candidates)} more" if total > len(candidates) else ""
        super().__init__(f"{name!r} matches {total} Systems: {listed}{more}.")
        self.name = name
        self.candidates = candidates
        self.total = total


class CatalogUnavailableError(CatalogError):
    code = "catalog_unavailable"

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason
