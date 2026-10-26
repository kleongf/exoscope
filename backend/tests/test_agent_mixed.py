"""Mixed answers retain typed archive comparisons without trusting model prose."""

from datetime import UTC, date, datetime

import pytest

from exoscope.agent import loop, runner
from exoscope.agent.tools import load_system as load_tool
from exoscope.agent.tools import web_search
from exoscope.catalog import System, load_system
from exoscope.catalog.models import LiveProvenance, Missing, SnapshotProvenance
from exoscope.websearch.models import WebSearchResult
from tests.catalog_fakes import FakeTap
from tests.test_agent import answer, call
from tests.test_agent_web import CLAIM, SYNTHESIS, evidence

QUESTION = "Compare their radii and evidence for liquid water"


def archive() -> System:
    rows: list[dict[str, object]] = [
        {
            "hostname": "TRAPPIST-1",
            "pl_name": f"TRAPPIST-1 {name}",
            "pl_letter": name,
            "pl_rade": radius,
            "pl_orbper": period,
            "pl_orbsmax": distance,
            "pl_rade_reflink": "Radius paper",
            "pl_orbper_reflink": "Period paper",
            "pl_orbsmax_reflink": "Distance paper",
        }
        for name, radius, period, distance in [
            ("b", 1.25, 2.0, 0.01),
            ("c", None, None, None),
            ("d", 0.75, 4.0, 0.03),
        ]
    ]
    system = load_system("TRAPPIST-1", tap=FakeTap({"TRAPPIST-1": rows}))
    system.provenance = SnapshotProvenance(
        source="NASA Exoplanet Archive (pscomppars)", snapshot_date=date(2026, 10, 24)
    )
    return system


def run_mixed(
    monkeypatch: pytest.MonkeyPatch, system: System, question: str = QUESTION
) -> loop.AgentResult:
    def load(_: str) -> System:
        return system

    monkeypatch.setattr(loop, "load_system", load)
    monkeypatch.setattr(load_tool, "load_system", load)
    monkeypatch.setattr(web_search, "search_web", evidence)
    replies = iter(
        [
            answer(call("web_search", query=question)),
            answer(SYNTHESIS),
        ]
    )
    return runner.run_loop(question, "TRAPPIST-1", lambda _: next(replies))


def test_mixed_finding_composes_typed_radii_with_gemma_synthesis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    system = archive()
    before = system.model_dump_json()
    result = run_mixed(monkeypatch, system)
    assert result.error is None
    assert "0.75 Earth radii (TRAPPIST-1 d) to 1.25 Earth radii (TRAPPIST-1 b)" in result.reply_text
    assert "NASA Exoplanet Archive (Snapshot 2026-10-24)" in result.reply_text
    assert "missing values remain missing" in result.reply_text
    assert "source papers: Radius paper" in result.reply_text
    assert SYNTHESIS in result.reply_text[:600]
    assert "999" not in result.reply_text and "water is certain" not in result.reply_text
    assert "Orbital period:" not in result.reply_text
    assert "Semi-major axis:" not in result.reply_text
    assert result.data.system is not None and result.data.system.model_dump_json() == before
    assert result.data.web_search is not None
    assert result.data.web_search.grounded_text == CLAIM
    assert result.data.web_search.supports == evidence(QUESTION).supports
    assert "Earth radii" not in result.data.web_search.grounded_text
    assert result.data.web_search.supports[0].text == CLAIM


def test_mixed_finding_includes_requested_period_and_distance_from_live_archive(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    system = archive()
    system.provenance = LiveProvenance(
        source="NASA Exoplanet Archive (pscomppars)",
        fetched_at=datetime(2026, 10, 25, tzinfo=UTC),
    )
    result = run_mixed(
        monkeypatch,
        system,
        "Compare radii, orbital periods and semi-major axes with evidence for liquid water",
    )
    assert "Live result fetched 2026-10-25T00:00:00+00:00" in result.reply_text
    assert "Orbital period: 2 day (TRAPPIST-1 b) to 4 day (TRAPPIST-1 d)" in result.reply_text
    assert "Semi-major axis: 0.01 AU (TRAPPIST-1 b) to 0.03 AU (TRAPPIST-1 d)" in result.reply_text
    assert "source papers: Period paper" in result.reply_text
    assert "source papers: Distance paper" in result.reply_text
    assert SYNTHESIS in result.reply_text[:600]


def test_all_missing_radii_never_become_zero_or_web_measurements(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    system = archive()
    for planet in system.planets:
        planet.radius = Missing(unit="Earth radii")
    result = run_mixed(monkeypatch, system)
    assert "Radius: missing for all planets." in result.reply_text
    assert "Earth radii" not in result.reply_text
    assert result.data.system is not None
    assert all(planet.radius.status == "missing" for planet in result.data.system.planets)


def test_failed_web_search_retains_archive_comparison_without_citation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    system = archive()

    def load(_: str) -> System:
        return system

    def search(query: str) -> WebSearchResult:
        return WebSearchResult(status="unavailable", query=query)

    monkeypatch.setattr(loop, "load_system", load)
    monkeypatch.setattr(load_tool, "load_system", load)
    monkeypatch.setattr(web_search, "search_web", search)
    replies = iter(
        [
            answer(call("web_search", query=QUESTION)),
            answer("Water is certain."),
        ]
    )
    result = runner.run_loop(QUESTION, "TRAPPIST-1", lambda _: next(replies))
    assert result.error is not None
    assert "0.75 Earth radii" in result.reply_text and "1.25 Earth radii" in result.reply_text
    assert "Snapshot 2026-10-24" in result.reply_text
    assert "no Web sources" in result.reply_text
    assert "According to" not in result.reply_text and "Water is certain" not in result.reply_text
