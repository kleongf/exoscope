"""Offline Systems, Comparisons and Samples for Project tests."""

from datetime import UTC, datetime, timedelta

from exoscope.catalog import Filter, Interpretation, Sample, System, load_system, search_catalog
from exoscope.compare import Comparison, compare
from exoscope.websearch.models import WebSearchResult, WebSource
from tests.catalog_fakes import unavailable
from tests.test_search_catalog import offline
from tests.test_search_catalog import unavailable as search_unavailable

T0 = datetime(2026, 10, 25, 15, 0, tzinfo=UTC)


def at(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


def snapshot_system(name: str = "TRAPPIST-1") -> System:
    return load_system(name, tap=unavailable)


def radius_comparison(system: System) -> Comparison:
    return compare(system, "radius", "insolation")


def small_planets() -> Sample:
    return search_catalog(
        [Filter(field="radius", op="<", value=2)],
        [Interpretation.model_validate({"term": "small", "as": "radius < 2 Earth radii"})],
        tap=search_unavailable,
        population=offline,
    )


def web_search(*urls: str) -> WebSearchResult:
    sources = [
        WebSource(id=f"s{i}", title=f"Page {i}", url=url, retrieved_at=T0, domain="example.org")
        for i, url in enumerate(urls)
    ]
    return WebSearchResult(status="ok", query="TRAPPIST-1 water", sources=sources)
