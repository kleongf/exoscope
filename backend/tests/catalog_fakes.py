"""An offline stand-in for the TAP endpoint, answering the catalog's own queries."""

import re
from collections.abc import Mapping, Sequence

from exoscope.catalog.errors import CatalogUnavailableError
from exoscope.catalog.resolve import normalize
from exoscope.catalog.snapshot import load_snapshots
from exoscope.catalog.tap import Row

_EQ = re.compile(r"= '([^']*)'")
_LIKE = re.compile(r"like '%([^%']*)%'")
_HOST = re.compile(r"where hostname = '([^']*)'")


def snapshot_rows() -> dict[str, list[dict[str, object]]]:
    return {h: s.rows for h, s in load_snapshots().items()}


class FakeTap:
    """Serves rows per hostname; records every ADQL query it receives."""

    def __init__(self, systems: Mapping[str, Sequence[Row]], extra_hosts: Sequence[str] = ()):
        self.systems = systems
        self.hosts = [*systems, *extra_hosts]
        self.queries: list[str] = []

    def _names(self, host: str) -> list[str]:
        return [host, *(str(r.get("pl_name")) for r in self.systems.get(host, []))]

    def __call__(self, adql: str) -> list[Row]:
        self.queries.append(adql)
        if (like := _LIKE.search(adql)) is not None:
            return [{"hostname": h} for h in self.hosts if like.group(1) in normalize(h)]
        if adql.startswith("select distinct hostname"):
            key = _EQ.findall(adql)[0]
            hits = [h for h in self.hosts if key in {normalize(n) for n in self._names(h)}]
            return [{"hostname": h} for h in hits]
        host = _HOST.search(adql)
        return list(self.systems.get(host.group(1), [])) if host else []


def unavailable(_adql: str) -> list[Row]:
    raise CatalogUnavailableError("simulated outage.")
