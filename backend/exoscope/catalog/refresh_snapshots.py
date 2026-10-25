"""Refresh bundled Snapshots from the live archive.

Usage (from backend/): uv run python -m exoscope.catalog.refresh_snapshots [hostname ...]
"""

import sys
from datetime import UTC, datetime

from exoscope.catalog.load_system import system_query
from exoscope.catalog.snapshot import SNAPSHOT_DIR, SnapshotFile, snapshot_path
from exoscope.catalog.tap import query_tap

DEFAULT_HOSTS = ("TRAPPIST-1", "TOI-700")


def refresh(hostname: str) -> None:
    rows = [dict(r) for r in query_tap(system_query(hostname))]
    if not rows:
        raise SystemExit(f"No rows for {hostname!r}; Snapshot not written.")
    snapshot = SnapshotFile(hostname=hostname, snapshot_date=datetime.now(UTC).date(), rows=rows)
    SNAPSHOT_DIR.mkdir(exist_ok=True)
    path = snapshot_path(hostname)
    path.write_text(snapshot.model_dump_json(indent=1) + "\n")
    print(f"{hostname}: {len(rows)} planets -> {path.name}")


def main() -> None:
    for hostname in sys.argv[1:] or DEFAULT_HOSTS:
        refresh(hostname)


if __name__ == "__main__":
    main()
