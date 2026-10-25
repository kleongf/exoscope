"""Record real elapsed operation time, including failed dispatches."""

from collections.abc import Generator
from contextlib import contextmanager
from time import monotonic

from exoscope.agent.models import ToolStep


@contextmanager
def timed_step(name: str, steps: list[ToolStep], detail: str) -> Generator[None]:
    started = monotonic()
    status = "failed"
    try:
        yield
        status = "completed"
    finally:
        steps.append(
            ToolStep(
                id=f"{name}-{len(steps) + 1}",
                name=name,
                status=status,
                detail=detail if status == "completed" else f"{name} failed.",
                elapsed_ms=(monotonic() - started) * 1000,
            )
        )
