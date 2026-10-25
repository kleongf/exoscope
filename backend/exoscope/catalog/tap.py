"""The NASA Exoplanet Archive TAP sync endpoint. Callers inject a TapQuery for tests."""

from collections.abc import Callable, Mapping
from typing import Protocol

import httpx
from pydantic import TypeAdapter, ValidationError

from exoscope.catalog.errors import CatalogUnavailableError

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
TIMEOUT_S = 5.0

Row = Mapping[str, object]
TapQuery = Callable[[str], list[Row]]


class LimitedTapQuery(Protocol):
    """A TapQuery that can also cap the rows returned (TAP MAXREC, applied after ORDER BY)."""

    def __call__(self, adql: str, /, maxrec: int | None = None) -> list[Row]: ...


_ROWS = TypeAdapter(list[dict[str, object]])


def query_tap(adql: str, maxrec: int | None = None, timeout: float = TIMEOUT_S) -> list[Row]:
    """Run one ADQL query live. Any failure becomes CatalogUnavailableError.

    Use maxrec rather than ADQL TOP to cap rows: the archive applies TOP before ORDER BY.
    """
    params: dict[str, str] = {"query": adql, "format": "json"}
    if maxrec is not None:
        params["MAXREC"] = str(maxrec)
    try:
        response = httpx.get(TAP_URL, params=params, timeout=timeout)
        response.raise_for_status()
        return list(_ROWS.validate_json(response.content))
    except httpx.HTTPError as exc:
        raise CatalogUnavailableError(f"NASA archive request failed: {exc}") from exc
    except ValidationError as exc:
        raise CatalogUnavailableError("NASA archive returned an unexpected response") from exc
