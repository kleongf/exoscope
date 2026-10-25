"""Turn-scoped Web policy and cited findings around the generic tool loop."""

from collections.abc import Callable

from exoscope.agent import loop
from exoscope.agent.result import AgentResult
from exoscope.agent.web_policy import CURRENT_WEB_POLICY, WebPolicy, web_finding


def _run(text: str, action: Callable[[], AgentResult]) -> AgentResult:
    token = CURRENT_WEB_POLICY.set(WebPolicy(text))
    try:
        result = action()
        evidence = result.data.web_search
        if evidence is not None:
            finding = web_finding(evidence, text, result.data.system)
            # Keep generic tool/provider errors visible, together with retained evidence.
            result.reply_text = f"{result.error} {finding}" if result.error else finding
        return result
    finally:
        CURRENT_WEB_POLICY.reset(token)


def run_agent(text: str, current_system: str | None = None) -> AgentResult:
    return _run(text, lambda: loop.run_agent(text, current_system))


def run_loop(text: str, current_system: str | None, generate: loop.Generate) -> AgentResult:
    """Use the same policy with an injected model for deterministic verification."""
    return _run(text, lambda: loop.run_loop(text, current_system, generate))
