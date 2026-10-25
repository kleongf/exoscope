from collections.abc import Sequence
from datetime import UTC, date, datetime

import pytest

from exoscope.catalog import (
    AmbiguousSystemError,
    CatalogUnavailableError,
    UnknownSystemError,
    load_system,
)
from exoscope.catalog.models import LiveProvenance, Measured, Missing, SnapshotProvenance
from tests.catalog_fakes import FakeTap, snapshot_rows, unavailable

FIXED = datetime(2026, 10, 25, 15, 0, tzinfo=UTC)
PLANET_QUANTITIES = (
    "orbital_period",
    "semi_major_axis",
    "radius",
    "mass",
    "insolation",
    "eccentricity",
    "inclination",
    "transit_midpoint",
    "argument_of_periastron",
)


def live_tap(extra_hosts: Sequence[str] = ()) -> FakeTap:
    return FakeTap(snapshot_rows(), extra_hosts=extra_hosts)


def test_live_trappist_has_every_orbital_value_with_unit_and_source() -> None:
    system = load_system("trappist 1", tap=live_tap(), clock=lambda: FIXED)

    assert system.hostname == "TRAPPIST-1"
    assert system.provenance == LiveProvenance(source=system.provenance.source, fetched_at=FIXED)
    assert [p.letter for p in system.planets] == list("bcdefgh")
    for planet in system.planets:
        for attr in PLANET_QUANTITIES:
            value = getattr(planet, attr)
            assert isinstance(value, Measured), f"{planet.name}.{attr}"
            assert value.reference is not None, f"{planet.name}.{attr}"
            assert value.reference.url and value.reference.url.startswith("https://")
        assert isinstance(planet.radius, Measured) and planet.radius.unit == "Earth radii"


def test_outage_falls_back_to_labelled_snapshot() -> None:
    system = load_system("Trappist-1", tap=unavailable)

    assert isinstance(system.provenance, SnapshotProvenance)
    assert system.provenance.snapshot_date == date(2026, 10, 25)
    assert len(system.planets) == 7


def test_backup_system_loads_from_snapshot_too() -> None:
    assert load_system("toi700", tap=unavailable).hostname == "TOI-700"


def test_planet_name_resolves_to_its_system() -> None:
    assert load_system("TRAPPIST-1 e", tap=live_tap()).hostname == "TRAPPIST-1"


def test_unknown_and_ambiguous_names_are_distinct_errors() -> None:
    tap = live_tap(extra_hosts=["Kepler-12", "Kepler-129"])

    with pytest.raises(UnknownSystemError):
        load_system("Planet Nonexistent", tap=tap)
    with pytest.raises(AmbiguousSystemError) as ambiguous:
        load_system("kepler", tap=tap)
    assert ambiguous.value.candidates == ["Kepler-12", "Kepler-129"]


def test_unknown_name_never_falls_back_to_a_snapshot() -> None:
    with pytest.raises(UnknownSystemError):
        load_system("trappist-2", tap=live_tap())


def test_outage_without_a_snapshot_says_so() -> None:
    with pytest.raises(CatalogUnavailableError, match="No Snapshot covers"):
        load_system("Kepler-186", tap=unavailable)


def test_missing_archive_value_is_missing_not_zero() -> None:
    rows = snapshot_rows()
    rows["TRAPPIST-1"][0]["pl_orbsmax"] = None
    system = load_system("TRAPPIST-1", tap=FakeTap(rows))

    assert isinstance(system.planets[0].semi_major_axis, Missing)
    assert system.planets[0].semi_major_axis.unit == "AU"


def test_quote_characters_never_reach_adql() -> None:
    tap = live_tap()
    with pytest.raises(UnknownSystemError):
        load_system("x'; drop table pscomppars --", tap=tap)
    assert tap.queries
    assert all(";" not in q and "--" not in q and "x'" not in q for q in tap.queries)


def test_apostrophes_are_stripped_on_both_sides() -> None:
    """Archive hostnames such as "Barnard's star" must resolve from the student's spelling."""
    tap = live_tap()
    with pytest.raises(UnknownSystemError):
        load_system("Barnard's star", tap=tap)
    assert any("BARNARDSSTAR" in q and "'''',''" in q for q in tap.queries)
