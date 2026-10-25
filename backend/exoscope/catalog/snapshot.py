"""Bundled Snapshots: raw pscomppars rows saved with their date, read when TAP fails."""

from datetime import date
from pathlib import Path

from pydantic import BaseModel

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"


class SnapshotFile(BaseModel):
    hostname: str
    snapshot_date: date
    rows: list[dict[str, object]]


def snapshot_path(hostname: str, directory: Path = SNAPSHOT_DIR) -> Path:
    slug = "".join(c if c.isalnum() else "-" for c in hostname.lower()).strip("-")
    return directory / f"{slug}.json"


def load_snapshots(directory: Path = SNAPSHOT_DIR) -> dict[str, SnapshotFile]:
    files = sorted(directory.glob("*.json"))
    snapshots = (SnapshotFile.model_validate_json(f.read_bytes()) for f in files)
    return {s.hostname: s for s in snapshots}


def planet_names(snapshot: SnapshotFile) -> list[str]:
    return [str(r["pl_name"]) for r in snapshot.rows if isinstance(r.get("pl_name"), str)]
