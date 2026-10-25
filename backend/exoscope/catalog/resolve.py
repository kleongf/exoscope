"""Name lookup: case- and spacing-insensitive, never a guess.

An exact match on hostname or planet name wins. Otherwise a unique partial match
on hostname is accepted; several partial matches are ambiguous; none is unknown.
"""

import re
from collections.abc import Iterable

from exoscope.catalog.errors import AmbiguousSystemError, UnknownSystemError
from exoscope.catalog.fields import TABLE
from exoscope.catalog.tap import TapQuery

MAX_CANDIDATES = 10
_NOT_KEY = re.compile(r"[^A-Z0-9+.]")


def normalize(name: str) -> str:
    """Uppercase, drop spaces/hyphens and anything unsafe. The key is safe inside ADQL quotes."""
    return _NOT_KEY.sub("", name.upper())


def _adql_norm(column: str) -> str:
    return f"upper(replace(replace({column},' ',''),'-',''))"


def _pick(name: str, hosts: list[str]) -> str:
    if not hosts:
        raise UnknownSystemError(name)
    if len(hosts) > 1:
        raise AmbiguousSystemError(name, sorted(hosts)[:MAX_CANDIDATES], total=len(hosts))
    return hosts[0]


def _hostnames(rows: Iterable[object]) -> list[str]:
    return sorted({str(h) for h in rows if isinstance(h, str)})


def resolve_live(name: str, tap: TapQuery) -> str:
    key = normalize(name)
    if not key:
        raise UnknownSystemError(name)
    exact = tap(
        f"select distinct hostname from {TABLE} "
        f"where {_adql_norm('hostname')} = '{key}' or {_adql_norm('pl_name')} = '{key}'"
    )
    if exact:
        return _pick(name, _hostnames(r.get("hostname") for r in exact))
    partial = tap(
        f"select distinct hostname from {TABLE} where {_adql_norm('hostname')} like '%{key}%'"
    )
    return _pick(name, _hostnames(r.get("hostname") for r in partial))


def resolve_offline(name: str, known: dict[str, list[str]]) -> str | None:
    """Resolve against Snapshot contents ({hostname: [planet names]}). None if not covered."""
    key = normalize(name)
    if not key:
        return None
    exact = [h for h, planets in known.items() if key in {normalize(n) for n in (h, *planets)}]
    if exact:
        return _pick(name, exact)
    partial = [h for h in known if key in normalize(h)]
    return _pick(name, partial) if partial else None
