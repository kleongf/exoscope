"""One JSON file per Project: round-trips exactly, and fails honestly."""

from pathlib import Path

import pytest

from exoscope.project import (
    ProjectCorruptError,
    ProjectNotFoundError,
    ProjectStore,
    record_turn,
)
from tests.project_fakes import T0, at, radius_comparison, snapshot_system


def test_saved_project_loads_back_identically(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    p = store.create("Rocky worlds", now=T0)
    trappist = snapshot_system()
    record_turn(p, "Open TRAPPIST-1", "Loaded.", now=at(1), system=trappist)
    record_turn(p, "Compare", "ok", now=at(2), comparison=radius_comparison(trappist))
    store.save(p)

    assert ProjectStore(tmp_path).load(p.id) == p


def test_create_saves_an_empty_project_with_a_fresh_id(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    a = store.create(None, now=T0)
    b = store.create("Hot Jupiters", now=at(1))

    assert a.id != b.id
    assert a.name == "New Project"
    assert store.load(a.id).systems == []


def test_list_is_newest_first_with_item_counts(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    old = store.create("Old", now=T0)
    new = store.create("New", now=at(1))
    record_turn(old, "Open", "ok", now=at(5), system=snapshot_system())
    store.save(old)

    listed = store.list()
    assert [(s.id, s.name, s.item_count) for s in listed] == [
        (old.id, "Old", 1),
        (new.id, "New", 0),
    ]
    assert listed[0].updated_at == at(5)


def test_missing_project_is_an_honest_error(tmp_path: Path) -> None:
    with pytest.raises(ProjectNotFoundError, match="p-0000beef"):
        ProjectStore(tmp_path).load("p-0000beef")


def test_ids_that_could_escape_the_directory_are_not_found(tmp_path: Path) -> None:
    with pytest.raises(ProjectNotFoundError):
        ProjectStore(tmp_path / "projects").load("../secrets")


@pytest.mark.parametrize(
    "content",
    ['{"format":"exoscope.project","version":1,"id":"p-0000beef","systems":[{', '{"format":"x"}'],
)
def test_corrupt_project_is_an_honest_error(tmp_path: Path, content: str) -> None:
    (tmp_path / "p-0000beef.json").write_text(content)
    with pytest.raises(ProjectCorruptError, match="p-0000beef"):
        ProjectStore(tmp_path).load("p-0000beef")


def test_list_shows_a_corrupt_project_instead_of_hiding_it(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    good = store.create("Good", now=T0)
    (tmp_path / "p-0000beef.json").write_text("not json")

    listed = {s.id: s for s in store.list()}
    assert listed[good.id].error is None
    assert listed["p-0000beef"].error is not None
    assert listed["p-0000beef"].item_count is None


def test_save_leaves_no_temporary_files(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    p = store.create("A", now=T0)
    store.save(p)
    assert [f.name for f in tmp_path.iterdir()] == [f"{p.id}.json"]
