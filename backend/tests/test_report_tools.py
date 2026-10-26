"""Typed tools and the manual route share the exporter and canonical Project."""

import pytest
from pydantic import ValidationError

from exoscope.agent import runner, turn
from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import ToolError
from exoscope.agent.tools.registry import TOOLS, tool_definitions
from exoscope.project import Project
from exoscope.report.context import ACTIVE_PROJECT, active_project, bind_project
from exoscope.report.models import ReportRequest
from tests.model_fakes import Item
from tests.report_fixtures import PNG, html, saved_project, snapshot, store
from tests.test_agent import answer, call
from tests.test_app import request

__all__ = ["saved_project"]


def test_strict_registry_and_canonical_id_discovery(saved_project: Project) -> None:
    names = {item["name"] for item in tool_definitions()}
    assert {"list_project_items", "export_report"} <= names
    with pytest.raises(ToolError, match="Choose and save"):
        TOOLS["export_report"].invoke(
            {"title": "Report", "include": {"comparisons": ["cmp-4"]}}, AgentResult()
        )
    with bind_project(saved_project, store()):
        items = TOOLS["list_project_items"].invoke({}, AgentResult()).payload
        assert items["systems"] == [
            {
                "id": "sys-2",
                "hostname": "TRAPPIST-1",
                "planets": [p.name for p in saved_project.systems[0].system.planets],
            }
        ]
        assert items["comparisons"] == [
            {
                "id": "cmp-4",
                "turn_id": "turn-3",
                "x": "Planet radius",
                "y": "Insolation",
                "planets": [r.planet for r in saved_project.comparisons[0].comparison.rows],
            }
        ]
        with pytest.raises(ValidationError):
            TOOLS["list_project_items"].invoke({"all": True}, AgentResult())
        with pytest.raises(ValidationError):
            TOOLS["export_report"].invoke(
                {"title": "R", "include": {"samples": [42]}}, AgentResult()
            )
    assert ACTIVE_PROJECT.get() is None


def test_injected_model_export_survives_turn_record_and_voice_failure(
    saved_project: Project,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    replies = iter(
        [
            answer(call("list_project_items")),
            answer(
                call(
                    "export_report",
                    title="Radius Report",
                    include={"comparisons": ["cmp-4"]},
                    summary="Gemma narrative\n\nA short Results paragraph.",
                )
            ),
            answer("The Report is ready."),
        ]
    )

    def agent(text: str, current: str | None) -> AgentResult:
        return runner.run_loop(text, current, lambda _: next(replies))

    def fail_voice(_: str) -> None:
        raise turn.voice.VoiceError("No voice")

    monkeypatch.setattr(turn, "run_agent", agent)
    monkeypatch.setattr(turn.voice, "synthesize", fail_voice)
    text = "Write a radius Report exactly as requested"
    response = turn.handle_turn(
        turn.TurnRequest(text=text, project_id=saved_project.id, report_snapshot=snapshot()),
        store(),
    )
    updated = response.project
    assert response.error is None and updated is not None
    assert updated == store().load(saved_project.id)
    assert updated.reports[0].includes == ["cmp-4"]
    assert updated.reports[0].request == text
    assert updated.turns[-1].transcript == text
    assert [s.name for s in response.steps[:2]] == ["list_project_items", "export_report"]
    assert "Gemma narrative" in html(updated) and PNG in html(updated)
    assert "Written by Gemma · not number-checked" in html(updated)
    assert html(updated).count("A short Results paragraph.") == 1
    assert html(updated).index("A short Results paragraph.") > html(updated).index(
        "<h2>Results</h2>"
    )
    assert response.warnings and ACTIVE_PROJECT.get() is None


def test_failed_scope_records_honest_error_and_no_report(
    saved_project: Project,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    replies = iter([answer(call("export_report", title="Wrong", include={"samples": ["smp-999"]}))])

    def agent(text: str, current: str | None) -> AgentResult:
        return runner.run_loop(text, current, lambda _: next(replies))

    monkeypatch.setattr(turn, "run_agent", agent)
    response = turn.handle_turn(
        turn.TurnRequest(text="Write Report", project_id=saved_project.id), store()
    )
    assert response.error is not None and "Unknown saved Sample" in response.error
    assert response.project is not None and not response.project.reports
    assert not store().load(saved_project.id).reports
    assert ACTIVE_PROJECT.get() is None
    with bind_project(saved_project, store()):
        with pytest.raises(RuntimeError), bind_project(None):
            assert ACTIVE_PROJECT.get() is None
            raise RuntimeError("interrupted")
        assert active_project().project is saved_project
    assert ACTIVE_PROJECT.get() is None


def test_two_exports_use_current_object(saved_project: Project) -> None:
    with bind_project(saved_project, store(), "Write two"):
        for include in ({"comparisons": ["cmp-4"]}, {"samples": ["smp-6"]}):
            TOOLS["export_report"].invoke({"title": "Report", "include": include}, AgentResult())
    assert len(saved_project.reports) == 2
    assert saved_project == store().load(saved_project.id)


def test_manual_route_no_credentials_and_html_delivery(
    saved_project: Project,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(*_: object) -> None:
        pytest.fail("Manual export called a provider")

    monkeypatch.setattr(turn, "run_agent", forbidden)
    monkeypatch.setattr(turn.voice, "synthesize", forbidden)
    body: dict[str, object] = {
        "title": "Manual",
        "include": {"samples": ["smp-6"]},
        "summary": "Student prose",
    }
    response = request("POST", f"/projects/{saved_project.id}/reports", body)
    assert response.status_code == 200
    updated = Project.model_validate(response.json())
    assert ReportRequest.model_validate_json(updated.reports[-1].request).title == "Manual"
    opened = request("GET", f"/reports/{updated.reports[-1].file}")
    assert opened.status_code == 200 and opened.headers["content-type"].startswith("text/html")
    assert opened.headers["content-disposition"].startswith("inline")
    assert "Student/template narrative" in opened.text
    assert "Written by Gemma" not in opened.text
    downloaded = request("GET", f"/reports/{updated.reports[-1].file}?download=true")
    assert downloaded.content == opened.content
    assert downloaded.headers["content-disposition"].startswith("attachment")
    assert request("GET", "/reports/report-unsafe.html").status_code == 404
    assert (
        request(
            "POST", f"/projects/{saved_project.id}/reports", {"title": "Empty", "include": {}}
        ).status_code
        == 422
    )


def test_completed_report_survives_model_reply_failure(
    saved_project: Project,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    def generate(_: list[Item]) -> dict[str, object]:
        nonlocal calls
        calls += 1
        if calls == 1:
            return answer(
                call(
                    "export_report", title="Saved before reply", include={"comparisons": ["cmp-4"]}
                )
            )
        raise RuntimeError("Provider failed after writing")

    def agent(text: str, current: str | None) -> AgentResult:
        return runner.run_loop(text, current, generate)

    monkeypatch.setattr(turn, "run_agent", agent)
    response = turn.handle_turn(
        turn.TurnRequest(text="Write Report", project_id=saved_project.id), store()
    )
    assert response.error is not None and response.project is not None
    assert len(response.project.reports) == 1
    assert store().load(saved_project.id).reports == response.project.reports
    assert "Saved before reply" in html(response.project)
    assert ACTIVE_PROJECT.get() is None
