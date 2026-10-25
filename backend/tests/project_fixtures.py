"""Complete durable conversation fixtures shared by Project persistence tests."""

from datetime import UTC, date, datetime

from exoscope.catalog.models import SnapshotProvenance
from exoscope.project.models import ConversationTurn
from exoscope.tool_steps import ToolStep
from exoscope.websearch.models import WebSearchResult, WebSource, WebSupport


def conversation_turn() -> ConversationTurn:
    return ConversationTurn(
        id=1,
        question="Does TRAPPIST-1 e have liquid water?",
        reply="Surface liquid water has not been established.",
        startedAt=1_792_886_400_000,
        finishedAt=1_792_886_401_000,
        steps=[
            ToolStep(
                id="step-1",
                name="web_search",
                status="completed",
                detail="Retrieved Web sources",
                elapsed_ms=1000,
            )
        ],
        provenance=SnapshotProvenance(
            source="NASA Exoplanet Archive", snapshot_date=date(2026, 10, 25)
        ),
        error=None,
        warnings=["Archive data cannot establish surface conditions."],
        appliedCommands=1,
        webSearch=WebSearchResult(
            status="ok",
            query="TRAPPIST-1 e liquid water",
            grounded_text="Surface liquid water has not been established.",
            sources=[
                WebSource(
                    id="web-1",
                    title="TRAPPIST-1 science",
                    url="https://example.org",
                    retrieved_at=datetime(2026, 10, 25, tzinfo=UTC),
                    domain="example.org",
                )
            ],
            supports=[
                WebSupport(
                    text="Surface liquid water has not been established.", source_ids=["web-1"]
                )
            ],
        ),
        hasSpokenReply=True,
    )
