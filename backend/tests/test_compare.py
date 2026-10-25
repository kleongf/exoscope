import pytest

from exoscope.catalog import System, load_system
from exoscope.catalog.models import Measured, Missing, SnapshotProvenance
from exoscope.compare import (
    ALLOWED,
    NothingToCompareError,
    UnknownPlanetError,
    UnknownPropertyError,
    compare,
)
from tests.catalog_fakes import unavailable


def snapshot_system(name: str) -> System:
    return load_system(name, tap=unavailable)


def without(system: System, planet: str, attr: str) -> System:
    """A copy of `system` with one planet's value removed, as the archive sometimes has."""
    planets = [
        p.model_copy(update={attr: Missing(unit=getattr(p, attr).unit)}) if p.name == planet else p
        for p in system.planets
    ]
    return system.model_copy(update={"planets": planets})


def test_trappist_radius_vs_insolation_plots_every_planet_with_units_and_sources() -> None:
    result = compare(snapshot_system("TRAPPIST-1"), "radius", "insolation")

    assert (result.x.label, result.x.unit) == ("Planet radius", "Earth radii")
    assert (result.y.label, result.y.unit) == ("Insolation", "Earth flux")
    assert [r.planet for r in result.plotted] == [f"TRAPPIST-1 {c}" for c in "bcdefgh"]
    assert result.excluded == []
    for row in result.rows:
        assert isinstance(row.x, Measured) and row.x.reference is not None
        assert isinstance(row.y, Measured) and row.y.err_lo is not None


def test_values_match_the_loaded_system_exactly() -> None:
    system = snapshot_system("TRAPPIST-1")
    result = compare(system, "orbital_period", "mass")

    for row, planet in zip(result.rows, system.planets, strict=True):
        assert row.x == planet.orbital_period
        assert row.y == planet.mass


def test_provenance_is_carried_through_per_system() -> None:
    result = compare(snapshot_system("TRAPPIST-1"), "radius", "mass")

    assert [p.hostname for p in result.provenance] == ["TRAPPIST-1"]
    assert isinstance(result.provenance[0].provenance, SnapshotProvenance)
    assert any("not be mutually consistent" in n for n in result.notes)


def test_planets_across_two_systems_keep_their_hostnames() -> None:
    systems = [snapshot_system("TRAPPIST-1"), snapshot_system("TOI-700")]
    result = compare(systems, "radius", "insolation", planets=["TRAPPIST-1 e", "TOI-700 d"])

    assert [(r.planet, r.hostname) for r in result.rows] == [
        ("TRAPPIST-1 e", "TRAPPIST-1"),
        ("TOI-700 d", "TOI-700"),
    ]
    assert [p.hostname for p in result.provenance] == ["TRAPPIST-1", "TOI-700"]


@pytest.mark.parametrize(
    ("attrs", "reason"),
    [
        (["radius"], "missing_x"),
        (["insolation"], "missing_y"),
        (["radius", "insolation"], "missing_both"),
    ],
)
def test_missing_values_are_excluded_with_a_reason_never_zero(
    attrs: list[str], reason: str
) -> None:
    system = snapshot_system("TRAPPIST-1")
    for attr in attrs:
        system = without(system, "TRAPPIST-1 d", attr)

    result = compare(system, "radius", "insolation")

    (excluded,) = result.excluded
    assert (excluded.planet, excluded.excluded) == ("TRAPPIST-1 d", reason)
    assert len(result.plotted) == 6


def test_limits_are_excluded_as_limit_only() -> None:
    system = snapshot_system("TRAPPIST-1")
    planets = [
        p.model_copy(update={"mass": p.mass.model_copy(update={"limit": "upper"})})
        if p.name == "TRAPPIST-1 h" and isinstance(p.mass, Measured)
        else p
        for p in system.planets
    ]
    result = compare(system.model_copy(update={"planets": planets}), "radius", "mass")

    assert [(r.planet, r.excluded) for r in result.excluded] == [("TRAPPIST-1 h", "limit_only")]


@pytest.mark.parametrize("bad", ["transit_midpoint", "habitability", "pl_rade", ""])
def test_non_allowlisted_property_is_an_explicit_error(bad: str) -> None:
    with pytest.raises(UnknownPropertyError) as err:
        compare(snapshot_system("TRAPPIST-1"), bad, "radius")
    assert err.value.allowed == list(ALLOWED)


def test_unknown_planet_is_an_explicit_error() -> None:
    with pytest.raises(UnknownPlanetError) as err:
        compare(snapshot_system("TRAPPIST-1"), "radius", "mass", planets=["TRAPPIST-1 z"])
    assert err.value.names == ["TRAPPIST-1 z"]


def test_empty_planet_list_is_an_explicit_error() -> None:
    with pytest.raises(NothingToCompareError):
        compare(snapshot_system("TRAPPIST-1"), "radius", "mass", planets=[])
