"""Small Responses-shaped fixtures; no SDK or paid network calls."""

from typing import Any

URL = "https://science.nasa.gov/exoplanets/?a=1&b=2#water"
OTHER_URL = "https://www.esa.int/Science_Exploration/Space_Science"


def annotation(text: str, marker: str, url: str = URL, title: str = "1") -> dict[str, Any]:
    start = text.index(marker)
    return {
        "type": "url_citation",
        "url": url,
        "title": title,
        "start_index": start,
        "end_index": start + len(marker),
    }


def block(claim: str = "Water remains uncertain.", url: str = URL) -> dict[str, Any]:
    marker = f"[[1]]({url})"
    text = claim + marker
    return {"type": "output_text", "text": text, "annotations": [annotation(text, marker, url)]}


def response(*blocks: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "resp_fixture",
        "object": "response",
        "status": "completed",
        "error": None,
        "incomplete_details": None,
        "output": [
            {
                "type": "web_search_call",
                "status": "completed",
                "action": {
                    "type": "search",
                    "query": "water",
                    "sources": [
                        {"type": "url", "url": URL, "title": "NASA Exoplanets"},
                        {"type": "url", "url": OTHER_URL},
                    ],
                },
            },
            {
                "type": "message",
                "role": "assistant",
                "status": "completed",
                "content": list(blocks) if blocks else [block()],
            },
        ],
    }
