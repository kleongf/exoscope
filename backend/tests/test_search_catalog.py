from datetime import UTC, date, datetime

import pytest

from exoscope.catalog.errors import CatalogUnavailableError, InvalidSearchError, UnknownFieldError
from exoscope.catalog.models import LiveProvenance, Measured, Missing, SnapshotProvenance
from exoscope.catalog.population import Population, decode, encode
from exoscope.catalog.sample_models import Filter, Interpretation, Sort, TextValue
from exoscope.catalog.search import search_catalog
from exoscope.catalog.tap import Row

FIXED = datetime(2026, 10, 25, 15, 0, tzinfo=UTC)
SNAP_DATE = date(2026, 10, 25)
REF = "<a refstr=X href=https://example.org/x target=ref>Smith &amp; Jones 2020</a>"


def planet(name: str, radius: float | None, period: float | None, **extra: object) -> Row:
    row: dict[str, object] = {
        "hostname": name.rsplit(" ", 1)[0],
        "pl_name": name,
        "pl_rade": radius,
        "pl_radeerr1": 0.1,
        "pl_radeerr2": -0.1,
        "pl_rade_reflink": REF,
        "pl_orbper": period,
        "discoverymethod": "Transit",
        "disc_refname": REF,
    }
    return row | extra


ROWS = [
    planet("A b", 1.0, 3.0),
    planet("A c", 1.5, 12.0),
    planet("B b", 0.5, 5.0, discoverymethod="Radial Velocity"),
    planet("C b", None, 4.0),  # no radius: excluded, never treated as zero
    planet("D b", 3.0, None),  # fails radius < 2 anyway: not excluded
    planet("E b", 1.9, None),  # no period: excluded
]
SMALL_SHORT = [Filter(field="radius", op="<", value=2), Filter(field="period", op="<", value=10)]


def offline() -> Population:
    return Population(snapshot_date=SNAP_DATE, rows=[dict(r) for r in ROWS])


def unavailable(_adql: str, maxrec: int | None = None) -> list[Row]:
    raise CatalogUnavailableError("simulated outage.")


def test_snapshot_search_filters_sorts_and_counts_exclusions() -> None:
    s = search_catalog(SMALL_SHORT, sort=Sort(field="radius"), tap=unavailable, population=offline)

    assert [p.name for p in s.planets] == ["B b", "A b"]
    assert s.matched == 2 and not s.truncated
    assert s.excluded.count == 2
    assert s.excluded.by_field == {"radius": 1, "orbital_period": 1}
    assert s.provenance == SnapshotProvenance(source=s.provenance.source, snapshot_date=SNAP_DATE)
    assert [f.field for f in s.filters] == ["radius", "orbital_period"]


def test_values_carry_units_uncertainty_and_unescaped_source() -> None:
    s = search_catalog(SMALL_SHORT, tap=unavailable, population=offline)
    radius = s.planets[0].values["radius"]
    method = s.planets[0].values["discovery_method"]

    assert isinstance(radius, Measured) and radius.unit == "Earth radii"
    assert radius.err_lo == 0.1 and radius.reference is not None
    assert radius.reference.label == "Smith & Jones 2020"
    assert isinstance(method, TextValue) and method.value == "Transit"
    assert isinstance(s.planets[0].values["mass"], Missing)


def test_descending_sort_limit_and_truncation() -> None:
    s = search_catalog(
        [Filter(field="radius", op=">", value=0)],
        sort=Sort(field="radius", direction="desc"),
        limit=2,
        tap=unavailable,
        population=offline,
    )
    assert [p.name for p in s.planets] == ["D b", "E b"]
    assert s.matched == 5 and s.truncated


def test_between_text_and_is_null_semantics() -> None:
    def names(filters: list[Filter]) -> list[str]:
        s = search_catalog(filters, tap=unavailable, population=offline)
        return [p.name for p in s.planets]

    assert names([Filter(field="radius", op="between", value=1.0, upper=1.9)]) == [
        "A b",
        "A c",
        "E b",
    ]
    assert names([Filter(field="method", op="=", value="radial velocity")]) == ["B b"]
    assert names([Filter(field="radius", op="is_null")]) == ["C b"]


@pytest.mark.parametrize(
    "bad",
    [
        Filter(field="colour", op="<", value=1),
        Filter(field="radius", op="like", value=1),
        Filter(field="radius", op="<", value="abc"),
        Filter(field="radius", op="<"),
        Filter(field="radius", op="between", value=3, upper=1),
        Filter(field="radius", op="is_null", value=1),
        Filter(field="discovery_method", op="<", value="Transit"),
        Filter(field="discovery_method", op="=", value="x' or 1=1 --"),
    ],
)
def test_invalid_filters_raise_before_any_query(bad: Filter) -> None:
    queries: list[str] = []

    def recording(adql: str, maxrec: int | None = None) -> list[Row]:
        queries.append(adql)
        return []

    with pytest.raises(InvalidSearchError):
        search_catalog([bad], tap=recording, population=offline)
    assert queries == []


def test_unknown_field_lists_the_allowlist() -> None:
    with pytest.raises(UnknownFieldError) as err:
        search_catalog([Filter(field="colour", op="<", value=1)], tap=unavailable)
    assert "radius" in err.value.allowed


def test_limit_and_text_sort_are_bounded() -> None:
    with pytest.raises(InvalidSearchError):
        search_catalog(SMALL_SHORT, limit=501, tap=unavailable, population=offline)
    with pytest.raises(InvalidSearchError):
        search_catalog(SMALL_SHORT, sort=Sort(field="discovery_method"), tap=unavailable)


class LiveTap:
    """Answers the three live queries from ROWS and records them."""

    def __init__(self, fail_exclusions: bool = False) -> None:
        self.calls: list[tuple[str, int | None]] = []
        self.fail_exclusions = fail_exclusions

    def __call__(self, adql: str, maxrec: int | None = None) -> list[Row]:
        self.calls.append((adql, maxrec))
        if adql.startswith("select count(*)"):
            return [{"n": 2}]
        if "coalesce(" in adql:
            if self.fail_exclusions:
                raise CatalogUnavailableError("403 Forbidden")
            return ROWS
        return [ROWS[2], ROWS[0]]


def test_live_search_queries_safely_and_labels_live() -> None:
    tap = LiveTap()
    s = search_catalog(
        SMALL_SHORT, sort=Sort(field="radius"), limit=50, tap=tap, clock=lambda: FIXED
    )

    assert s.provenance == LiveProvenance(source=s.provenance.source, fetched_at=FIXED)
    assert [p.name for p in s.planets] == ["B b", "A b"] and s.matched == 2
    assert s.excluded.count == 2
    rows_q, rows_max = next(c for c in tap.calls if c[1] is not None)
    assert rows_max == 50 and " top " not in rows_q
    assert "where pl_rade < 2.0 and pl_orbper < 10.0 and pl_rade is not null" in rows_q
    assert rows_q.endswith("order by pl_rade asc, pl_name")
    excluded_q = next(q for q, _ in tap.calls if "coalesce(" in q)
    assert " or " not in excluded_q and "is null" not in excluded_q
    assert "coalesce(pl_rade, 1.0) < 2.0" in excluded_q


def test_failed_exclusion_query_counts_from_snapshot_with_a_note() -> None:
    s = search_catalog(SMALL_SHORT, tap=LiveTap(fail_exclusions=True), population=offline)

    assert s.provenance.mode == "live"
    assert s.excluded.count == 2
    assert any("Snapshot" in n for n in s.notes)


def test_loaded_interpretations_always_carry_a_caveat() -> None:
    items = [
        Interpretation.model_validate({"term": "small", "as": "radius < 2 Earth radii"}),
        Interpretation.model_validate({"term": "Earth-like", "as": "0.8-1.5 Earth radii"}),
    ]
    s = search_catalog(SMALL_SHORT, items, tap=unavailable, population=offline)

    assert s.interpretations[0].caveat is None
    assert s.interpretations[1].caveat
    assert s.model_dump()["interpretations"][0]["as"] == "radius < 2 Earth radii"


def test_population_round_trips_through_its_compact_encoding() -> None:
    columns = ["hostname", "pl_name", "pl_rade", "pl_rade_reflink", "disc_refname"]
    decoded = decode(encode(ROWS, columns, SNAP_DATE))

    assert decoded.snapshot_date == SNAP_DATE
    assert decoded.rows[0] == {c: ROWS[0].get(c) for c in columns}
    assert decoded.rows[3]["pl_rade"] is None
