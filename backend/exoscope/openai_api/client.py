"""Server-only OpenAI HTTP client. No retries, redirects or environment proxies.

Failure messages carry a status code and an error code at most, never a provider body, URL,
header or exception text, which can contain credentials.
"""

import os
from collections.abc import Generator
from contextlib import contextmanager
from typing import cast

import httpx

BASE_URL = "https://api.openai.com"


class OpenAIUnavailableError(Exception):
    """No key is configured. The message is safe to show."""


def openai_key() -> str | None:
    # Read at call time so the app can load its chosen dotenv first.
    return os.environ.get("OPENAI_API_KEY", "").strip() or None


@contextmanager
def openai_client(timeout: httpx.Timeout) -> Generator[httpx.Client]:
    key = openai_key()
    if key is None:
        raise OpenAIUnavailableError("OPENAI_API_KEY is not configured.")
    with httpx.Client(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {key}"},
        timeout=timeout,
        follow_redirects=False,
        transport=httpx.HTTPTransport(retries=0),
        trust_env=False,
    ) as client:
        yield client


def _error_code(response: httpx.Response) -> str | None:
    try:
        body: object = response.json()
    except ValueError:
        return None
    error = cast(dict[str, object], body).get("error") if isinstance(body, dict) else None
    code = cast(dict[str, object], error).get("code") if isinstance(error, dict) else None
    return code if isinstance(code, str) else None


def failure_message(service: str, exc: Exception) -> str:
    """A specific, safe message for a failed OpenAI request made on behalf of `service`."""
    if isinstance(exc, TimeoutError | httpx.TimeoutException):
        return f"{service} took too long to answer. Please ask again."
    if isinstance(exc, httpx.HTTPStatusError):
        return _status_message(exc.response)
    return f"{service} could not complete this turn. Please ask again."


def _status_message(response: httpx.Response) -> str:
    status = response.status_code
    if status == 429:
        if _error_code(response) == "insufficient_quota":
            return "The OpenAI account has no remaining quota. Add credit, then ask again."
        return "OpenAI's rate limit was reached. Wait a moment and ask again."
    if status in (401, 403):
        return "OpenAI rejected the API key. Check OPENAI_API_KEY."
    if status >= 500:
        return f"OpenAI's servers returned an error ({status}). Please ask again."
    return f"OpenAI rejected the request ({status}). Please ask again."
