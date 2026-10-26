"""Escaping shared by the Report's HTML, links and inert evidence JSON."""

import json
from html import escape
from urllib.parse import urlsplit


def safe_json(value: object) -> str:
    text = json.dumps(value, ensure_ascii=False, allow_nan=False)
    for char in ("<", ">", "&", "\u2028", "\u2029"):
        text = text.replace(char, f"\\u{ord(char):04x}")
    return text


def safe_url(value: str | None) -> str | None:
    if not value or any(ord(char) < 33 for char in value) or "\\" in value:
        return None
    try:
        parts = urlsplit(value)
        valid = (
            parts.scheme in {"https", "http"}
            and parts.hostname
            and parts.username is None
            and parts.password is None
        )
    except ValueError:
        return None
    return value if valid else None


def link(label: str, url: str | None) -> str:
    target = safe_url(url)
    text = escape(label)
    return f'<a href="{escape(target, quote=True)}" rel="noreferrer">{text}</a>' if target else text
