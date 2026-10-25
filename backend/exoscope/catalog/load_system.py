"""load_system: a model-free tool. Live first; Snapshot only when the archive is unreachable."""

from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from exoscope.catalog.errors import CatalogUnavailableError, UnknownSystemError
from exoscope.catalog.fields import SOURCE, TABLE, select_columns
from exoscope.catalog.models import LiveProvenance, SnapshotProvenance, System
from exoscope.catalog.parse import build_system
from exoscope.catalog.resolve import resolve_live, resolve_offline
from exoscope.catalog.snapshot import SNAPSHOT_DIR, load_snapshots, planet_names
from exoscope.catalog.tap import TapQuery, query_tap

Clock = Callable[[], datetime]


def _now() -> datetime:
    return datetime.now(UTC)


def system_query(hostname: str) -> str:
    escaped = hostname.replace("'", "''")
    return f"select {','.join(select_columns())} from {TABLE} where hostname = '{escaped}'"


def load_system(
    name: str,
    *,
    tap: TapQuery = query_tap,
    clock: Clock = _now,
    snapshot_dir: Path = SNAPSHOT_DIR,
) -> System:
    """Resolve `name` to one System and return it with provenance.

    Unknown or ambiguous names raise immediately, even if a Snapshot exists.
    """
    try:
        hostname = resolve_live(name, tap)
        rows = tap(system_query(hostname))
        if not rows:
            raise UnknownSystemError(name)
        return build_system(rows, LiveProvenance(source=SOURCE, fetched_at=clock()))
    except CatalogUnavailableError as exc:
        return _from_snapshot(name, exc, snapshot_dir)


def _from_snapshot(name: str, cause: CatalogUnavailableError, directory: Path) -> System:
    snapshots = load_snapshots(directory)
    known = {h: planet_names(s) for h, s in snapshots.items()}
    hostname = resolve_offline(name, known)
    if hostname is None:
        raise CatalogUnavailableError(
            f"{cause.reason} No Snapshot covers {name!r}; "
            f"Snapshots exist for: {', '.join(sorted(known)) or 'none'}."
        ) from cause
    snapshot = snapshots[hostname]
    provenance = SnapshotProvenance(source=SOURCE, snapshot_date=snapshot.snapshot_date)
    return build_system(snapshot.rows, provenance)
