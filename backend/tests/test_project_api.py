"""The Project endpoints the switcher uses: list, create, load. Errors are honest."""

from collections.abc import Iterator
from pathlib import Path

import pytest

from exoscope.app import app, get_projects
from exoscope.project import ProjectStore
from tests.test_app import request


@pytest.fixture
def store(tmp_path: Path) -> Iterator[ProjectStore]:
    projects = ProjectStore(tmp_path)
    app.dependency_overrides[get_projects] = lambda: projects
    yield projects
    app.dependency_overrides.clear()


def test_create_then_list_then_load(store: ProjectStore) -> None:
    assert request("GET", "/projects").json() == []

    created = request("POST", "/projects", {"name": "Rocky worlds"}).json()
    assert created["name"] == "Rocky worlds" and created["systems"] == []

    listed = request("GET", "/projects").json()
    assert [(p["id"], p["item_count"], p["error"]) for p in listed] == [(created["id"], 0, None)]
    assert request("GET", f"/projects/{created['id']}").json() == created


def test_new_project_without_a_name(store: ProjectStore) -> None:
    assert request("POST", "/projects", {}).json()["name"] == "New Project"


def test_missing_project_is_404_with_a_message(store: ProjectStore) -> None:
    response = request("GET", "/projects/p-0000beef")
    assert response.status_code == 404
    assert "p-0000beef" in response.json()["detail"]


def test_corrupt_project_is_409_with_a_message(store: ProjectStore) -> None:
    (store.root / "p-0000beef.json").write_text("{")
    response = request("GET", "/projects/p-0000beef")
    assert response.status_code == 409
    assert "damaged" in response.json()["detail"]
