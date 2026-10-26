"""Canonical item turn IDs associate evidence with numbered recorded tool steps."""

from html import escape

from exoscope.report.selection import Evidence


def tool_log(evidence: Evidence) -> str:
    requests = [
        (f"System {s.system.hostname}", s.turn_id, "load_system") for s in evidence.system_items
    ]
    requests += [(f"comparison {s.id}", s.turn_id, "compare") for s in evidence.comparisons]
    requests += [(f"Sample {s.id}", s.turn_id, "search_catalog") for s in evidence.samples]
    requests += [(f"Web source {s.id}", s.turn_id, "web_search") for s in evidence.sources]
    lines: dict[tuple[str, int], str] = {}
    missing: list[str] = []
    for label, turn_id, name in requests:
        turns = [turn for turn in evidence.turns if turn.id == turn_id]
        steps = [
            (i, step)
            for turn in turns
            for i, step in enumerate(turn.steps)
            if step.name == name and step.status == "completed"
        ]
        if len(turns) != 1 or len(steps) != 1:
            missing.append(f"<li>{escape(label)}: associated tool step unavailable.</li>")
            continue
        turn, (position, step) = turns[0], steps[0]
        lines[(turn.id, position)] = (
            f"<li>Request: {escape(turn.transcript)}<br>Tool call: {escape(step.name)}<br>"
            f"Result: {escape(step.detail)} · {escape(step.status)} · {step.elapsed_ms} ms</li>"
        )
    numbered = "<ol>" + "".join(lines.values()) + "</ol>" if lines else ""
    unavailable = "<ul>" + "".join(missing) + "</ul>" if missing else ""
    return numbered + unavailable
