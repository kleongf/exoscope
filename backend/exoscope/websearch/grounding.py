"""Parse Responses API web-search evidence without claiming guaranteed semantic spans.

Annotations index citation Markdown, using Python characters and exclusive ends. OpenAI cites
as `claim ([domain](url?utm_source=openai))`; the parentheses may sit inside or outside the
annotated span, and the tracking parameter is dropped so a cited page matches its search source.
Our parser convention associates each validated marker with the immediately
preceding original paragraph (or text since the previous citation). Adjacent
markers share that nearby text. This records citation placement, not a semantic
verification of the claim. Unannotated links never create WebSupport entries.
"""

import hashlib
import re
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import urlsplit, urlunsplit

from pydantic import HttpUrl, ValidationError

from exoscope.websearch.models import WebSearchResult, WebSource, WebSupport


def _record(value: object) -> dict[str, Any]:
    return cast("dict[str, Any]", value) if isinstance(value, dict) else {}


def _items(value: object) -> list[Any]:
    return cast("list[Any]", value) if isinstance(value, list) else []


def _domain(url: str) -> str | None:
    if "\\" in url or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in url):
        return None
    try:
        parsed, validated = urlsplit(url), HttpUrl(url)
        if (
            parsed.scheme not in {"http", "https"}
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port == 0
        ):
            return None
        return parsed.hostname if parsed.hostname and validated.host else None
    except (ValueError, ValidationError):
        return None


def _untracked(url: str) -> str:
    parts = urlsplit(url)
    query = "&".join(p for p in parts.query.split("&") if p and p != "utm_source=openai")
    return urlunsplit(parts._replace(query=query))


def _title(value: object, url: str, domain: str) -> str:
    title = value.strip() if isinstance(value, str) else ""
    return title if title and not title.strip("[] ").isdecimal() and title != url else domain


def _source(
    raw: dict[str, Any],
    sources: dict[str, WebSource],
    retrieved_at: datetime,
) -> WebSource | None:
    url = raw.get("url")
    url = _untracked(url) if isinstance(url, str) else url
    domain = _domain(url) if isinstance(url, str) else None
    if not isinstance(url, str) or domain is None:
        return None
    title = _title(raw.get("title"), url, domain)
    if url not in sources:
        sources[url] = WebSource(
            id="web-" + hashlib.sha256(url.encode("utf-8")).hexdigest()[:24],
            title=title,
            url=url,
            domain=domain,
            retrieved_at=retrieved_at,
        )
    elif sources[url].title == domain and title != domain:
        sources[url].title = title
    return sources[url]


def _marker(text: str, annotation: dict[str, Any]) -> tuple[int, int] | None:
    start, end, url = (
        annotation.get("start_index"),
        annotation.get("end_index"),
        annotation.get("url"),
    )
    if (
        annotation.get("type") != "url_citation"
        or type(start) is not int
        or type(end) is not int
        or not 0 <= start < end <= len(text)
        or not isinstance(url, str)
    ):
        return None
    # Accept numbered [[1]](url) and normal [label](url), including <url>
    # destinations and balanced parentheses inside URLs. The destination must
    # match the annotation exactly; never infer citations by scanning prose.
    if text[start] == "(" and text[end - 1] == ")" and text[start + 1 : start + 2] == "[":
        start, end = start + 1, end - 1  # OpenAI's "([domain](url))" with parens in the span
    marker = text[start:end]
    label, separator, destination = marker[1:].partition("](")
    if (
        not marker.startswith("[")
        or (start > 0 and text[start - 1] == "!")
        or not separator
        or not label.strip()
        or re.fullmatch(r"(?:\[[^\[\]\r\n]+\]|[^\[\]\r\n]+)", label) is None
        or not destination.endswith(")")
    ):
        return None
    target = destination[:-1]
    if target not in {url, f"<{url}>"}:
        return None
    if start > 0 and text[start - 1] == "(" and text[end : end + 1] == ")":
        return start - 1, end + 1  # the wrapping parentheses belong to the citation
    return start, end


def _citations(
    block: dict[str, Any],
    sources: dict[str, WebSource],
    retrieved_at: datetime,
) -> list[tuple[int, int, WebSource]]:
    text = block["text"]
    if not isinstance(text, str):
        raise ValueError("Malformed output text")
    citations: list[tuple[int, int, WebSource]] = []
    for item in _items(block.get("annotations")):
        annotation = _record(item)
        bounds = _marker(text, annotation)
        if bounds is not None and (source := _source(annotation, sources, retrieved_at)):
            citations.append((*bounds, source))
    return sorted(citations, key=lambda citation: citation[:2])


def _supports(
    block: dict[str, Any],
    sources: dict[str, WebSource],
    retrieved_at: datetime,
) -> list[WebSupport]:
    text = block["text"]
    supports: list[WebSupport] = []
    cursor = 0
    nearby = ""
    for start, end, source in _citations(block, sources, retrieved_at):
        if start < cursor:
            continue
        between = text[cursor:start]
        if between.strip():
            # A blank line starts a new paragraph; do not cross it for support.
            nearby = re.split(r"\n\s*\n", between)[-1].strip()
        elif re.search(r"\n\s*\n", between):
            nearby = ""
        if nearby:
            support = WebSupport(text=nearby, source_ids=[source.id])
            if supports and supports[-1].text == nearby:
                if source.id not in supports[-1].source_ids:
                    supports[-1].source_ids.append(source.id)
            elif support not in supports:
                supports.append(support)
        cursor = end
    return supports


def _output(response: object) -> list[dict[str, Any]]:
    body = _record(response)
    if (
        body.get("status") != "completed"
        or body.get("error") is not None
        or body.get("incomplete_details") is not None
    ):
        raise ValueError("Incomplete search response")
    raw: object = body.get("output")
    items = _items(raw)
    if not isinstance(raw, list) or any(not isinstance(item, dict) for item in items):
        raise ValueError("Malformed output")
    output = [_record(item) for item in items]
    calls = [item for item in output if item.get("type") == "web_search_call"]
    if not calls or any(item.get("status") != "completed" for item in calls):
        raise ValueError("Missing completed search")
    return output


def _text_blocks(output: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for item in output:
        if item.get("type") != "message" or item.get("role") != "assistant":
            continue
        if item.get("status") != "completed":
            raise ValueError("Incomplete assistant message")
        for raw in _items(item.get("content")):
            block = _record(raw)
            if block.get("type") == "output_text":
                if not isinstance(block.get("text"), str):
                    raise ValueError("Malformed output text")
                blocks.append(block)
    return blocks


def grounded_result(query: str, response: object) -> WebSearchResult:
    """Require completed search and usable annotation-backed nearby text."""
    output = _output(response)
    retrieved_at = datetime.now(UTC)
    sources: dict[str, WebSource] = {}
    for item in output:
        if item.get("type") == "web_search_call":
            for raw in _items(_record(item.get("action")).get("sources")):
                _source(_record(raw), sources, retrieved_at)
    blocks = _text_blocks(output)
    supports: list[WebSupport] = []
    for block in blocks:
        for support in _supports(block, sources, retrieved_at):
            if support not in supports:
                supports.append(support)
    text = "\n\n".join(block["text"] for block in blocks)
    if not text.strip() or not supports:
        raise ValueError("Missing usable annotation-backed evidence")
    return WebSearchResult(
        status="ok",
        query=query,
        grounded_text=text,
        sources=list(sources.values()),
        supports=supports,
    )
