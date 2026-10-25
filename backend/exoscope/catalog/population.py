"""The population Snapshot: every pscomppars planet with the searchable columns.

Read when TAP fails.

Stored gzipped and columnar, with source-paper reflinks deduplicated into a table.

Refresh (from backend/): uv run python -m exoscope.catalog.population
"""

import gzip
from datetime import UTC, date, datetime
from functools import cache
from pathlib import Path

from pydantic import BaseModel

from exoscope.catalog.fields import TABLE
from exoscope.catalog.search_fields import population_columns
from exoscope.catalog.snapshot import SNAPSHOT_DIR
from exoscope.catalog.tap import Row, TapQuery, query_tap

POPULATION_PATH = SNAPSHOT_DIR / "population.json.gz"
REFLINK_COLUMNS_SUFFIX = ("_reflink", "_refname")
REFRESH_TIMEOUT_S = 120.0


class PopulationFile(BaseModel):
    snapshot_date: date
    columns: list[str]
    refs: list[str]
    rows: list[list[float | int | str | None]]


class Population(BaseModel):
    snapshot_date: date
    rows: list[dict[str, object]]


def _is_ref(column: str) -> bool:
    return column.endswith(REFLINK_COLUMNS_SUFFIX)


def encode(rows: list[Row], columns: list[str], snapshot_date: date) -> PopulationFile:
    refs: dict[str, int] = {}
    encoded: list[list[float | int | str | None]] = []
    for row in rows:
        out: list[float | int | str | None] = []
        for col in columns:
            value = row.get(col)
            if _is_ref(col) and isinstance(value, str):
                out.append(refs.setdefault(value, len(refs)))
            else:
                out.append(value if isinstance(value, float | int | str) else None)
        encoded.append(out)
    return PopulationFile(
        snapshot_date=snapshot_date, columns=columns, refs=list(refs), rows=encoded
    )


def decode(file: PopulationFile) -> Population:
    rows: list[dict[str, object]] = []
    for values in file.rows:
        row: dict[str, object] = {}
        for col, value in zip(file.columns, values, strict=True):
            row[col] = file.refs[value] if _is_ref(col) and isinstance(value, int) else value
        rows.append(row)
    return Population(snapshot_date=file.snapshot_date, rows=rows)


@cache
def load_population(path: Path = POPULATION_PATH) -> Population:
    return decode(PopulationFile.model_validate_json(gzip.decompress(path.read_bytes())))


def _slow_query(adql: str) -> list[Row]:
    return query_tap(adql, timeout=REFRESH_TIMEOUT_S)


def refresh(tap: TapQuery | None = None, path: Path = POPULATION_PATH) -> int:
    """Fetch every planet live (slow: ~18 MB) and rewrite the population Snapshot."""
    columns = population_columns()
    run: TapQuery = tap or _slow_query
    rows = run(f"select {','.join(columns)} from {TABLE}")
    if not rows:
        raise SystemExit("The archive returned no rows; population Snapshot not written.")
    file = encode(rows, columns, datetime.now(UTC).date())
    path.write_bytes(gzip.compress(file.model_dump_json().encode(), compresslevel=9, mtime=0))
    return len(rows)


if __name__ == "__main__":
    print(f"{refresh()} planets -> {POPULATION_PATH.name}")
