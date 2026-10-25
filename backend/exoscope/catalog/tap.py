"""The NASA Exoplanet Archive TAP sync endpoint. Callers inject a TapQuery for tests."""

from collections.abc import Callable, Mapping

import httpx
from pydantic import TypeAdapter, ValidationError

from exoscope.catalog.errors import CatalogUnavailableError

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
TIMEOUT_S = 5.0

Row = Mapping[str, object]
TapQuery = Callable[[str], list[Row]]

_ROWS = TypeAdapter(list[dict[str, object]])


def query_tap(adql: str) -> list[Row]:
    """Run one ADQL query live. Any failure becomes CatalogUnavailableError."""
    try:
        response = httpx.get(TAP_URL, params={"query": adql, "format": "json"}, timeout=TIMEOUT_S)
        response.raise_for_status()
        return list(_ROWS.validate_json(response.content))
    except httpx.HTTPError as exc:
        raise CatalogUnavailableError(f"NASA archive request failed: {exc}") from exc
    except ValidationError as exc:
        raise CatalogUnavailableError("NASA archive returned an unexpected response") from exc
