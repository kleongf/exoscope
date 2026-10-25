"""What a Project keeps from each turn: work builds up and is never replaced."""

from exoscope.project import Project, StepRecord, new_project, record_report, record_turn
from tests.project_fakes import T0, at, radius_comparison, small_planets, snapshot_system


def fresh() -> Project:
    return new_project("p-0000000a", "Rocky worlds", T0)


def test_new_project_is_empty() -> None:
    p = fresh()
    assert (p.name, p.created_at, p.updated_at, p.current_system) == (
        "Rocky worlds",
        T0,
        T0,
        None,
    )
    assert p.turns == p.systems == p.samples == p.comparisons == p.web_sources == p.reports == []


def test_opening_a_second_system_keeps_the_first_and_its_comparison() -> None:
    p = fresh()
    trappist = snapshot_system("TRAPPIST-1")
    record_turn(p, "Open TRAPPIST-1", "Loaded.", now=at(1), system=trappist)
    record_turn(
        p, "Compare radius and irradiation", "Done.", now=at(2),
        comparison=radius_comparison(trappist),
    )  # fmt: skip
    record_turn(p, "Open TOI-700", "Loaded.", now=at(3), system=snapshot_system("TOI-700"))

    assert [s.system.hostname for s in p.systems] == ["TRAPPIST-1", "TOI-700"]
    assert len(p.comparisons) == 1
    assert p.current_system == "TOI-700"
    assert p.updated_at == at(3)


def test_reopening_a_system_updates_it_in_place() -> None:
    p = fresh()
    record_turn(p, "Open TRAPPIST-1", "Loaded.", now=at(1), system=snapshot_system())
    first = p.systems[0].id
    record_turn(p, "Open TRAPPIST-1 again", "Loaded.", now=at(5), system=snapshot_system())

    assert [s.id for s in p.systems] == [first]
    assert p.systems[0].opened_at == at(5)
    assert p.systems[0].turn_id == p.turns[1].id


def test_every_item_links_to_the_turn_that_made_it() -> None:
    p = fresh()
    steps = [
        StepRecord(name="search_catalog", status="completed", detail="12 planets", elapsed_ms=1300)
    ]
    record_turn(
        p, "Find small planets", "Found them.", now=at(1), steps=steps, sample=small_planets()
    )

    turn = p.turns[0]
    assert (turn.transcript, turn.reply_text, turn.at, turn.steps) == (
        "Find small planets",
        "Found them.",
        at(1),
        steps,
    )
    assert p.samples[0].turn_id == turn.id
    assert p.samples[0].sample.interpretations[0].term == "small"


def test_item_ids_are_unique_across_kinds() -> None:
    p = fresh()
    trappist = snapshot_system()
    record_turn(p, "Open", "ok", now=at(1), system=trappist)
    record_turn(p, "Compare", "ok", now=at(2), comparison=radius_comparison(trappist))
    record_turn(p, "Compare again", "ok", now=at(3), comparison=radius_comparison(trappist))
    ids = [p.systems[0].id, *(c.id for c in p.comparisons), *(t.id for t in p.turns)]
    assert len(set(ids)) == len(ids)


def test_a_failed_turn_is_logged_but_adds_no_items() -> None:
    p = fresh()
    record_turn(p, "Open Kepler-9999", "", now=at(1), error="Unknown System Kepler-9999.")
    assert p.turns[0].error == "Unknown System Kepler-9999."
    assert p.systems == []


def test_a_report_keeps_only_its_metadata() -> None:
    p = fresh()
    trappist = snapshot_system()
    record_turn(p, "Open", "ok", now=at(1), system=trappist)
    record_turn(p, "Compare", "ok", now=at(2), comparison=radius_comparison(trappist))
    included = [p.comparisons[0].id, p.systems[0].id]

    report = record_report(
        p,
        title="TRAPPIST-1: radius vs irradiation",
        request="a report on the radius comparison",
        includes=included,
        file="rep-5.html",
        now=at(3),
    )

    assert p.reports == [report]
    assert (report.includes, report.file, report.written_at) == (included, "rep-5.html", at(3))
    assert p.updated_at == at(3)
