"""Observe structured function calls, tool-result use, and optional search grounding."""

import secrets
from collections.abc import Callable
from urllib.parse import urlparse

from google import genai
from google.genai import types

MODEL = "gemma-4-31b-it"
Generate = Callable[[list[types.Content], list[types.Tool]], types.GenerateContentResponse]


def declaration() -> types.Tool:
    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="smoke_probe",
                description="Fetch a fresh verification nonce from the local smoke fixture.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={"id": types.Schema(type=types.Type.STRING)},
                    required=["id"],
                ),
            )
        ]
    )


def grounded_sources(candidate: types.Candidate, text: str) -> int:
    """Require real search queries, Web sources, and a citation tied to answer text."""
    metadata = candidate.grounding_metadata
    if metadata is None or not metadata.web_search_queries:
        return 0
    chunks = metadata.grounding_chunks or []
    valid_indices = {
        i
        for i, chunk in enumerate(chunks)
        if chunk.web
        and chunk.web.title
        and chunk.web.uri
        and urlparse(chunk.web.uri).scheme in {"https", "http"}
        and urlparse(chunk.web.uri).netloc
    }
    for support in metadata.grounding_supports or []:
        if (
            support.segment
            and support.segment.text
            and support.segment.text in text
            and valid_indices.intersection(support.grounding_chunk_indices or [])
        ):
            return len(valid_indices)
    return 0


def exercise(generate: Generate, *, mixed: bool) -> str:
    tools = [declaration()]
    prompt = (
        'Call smoke_probe with id "exoscope-smoke". Then state the exact returned nonce '
        "in your final answer. This is synthetic smoke data, not archive data."
    )
    if mixed:
        tools.append(types.Tool(google_search=types.GoogleSearch()))
        prompt += (
            " Also use Google Search to find the NASA Exoplanet Archive website now; "
            "include a cited sentence about it in the final answer. Use both tools."
        )
    contents = [types.Content(role="user", parts=[types.Part(text=prompt)])]
    # The nonce is absent from the prompt and cannot be guessed from model training.
    nonce = secrets.token_hex(12)
    observed_call = False
    for _ in range(4):
        response = generate(contents, tools)
        candidates = response.candidates or []
        if not candidates or not candidates[0].content:
            raise ValueError(f"No model content; prompt_feedback={response.prompt_feedback}")
        candidate = candidates[0]
        content = candidate.content
        assert content is not None
        parts = content.parts or []
        calls = [part.function_call for part in parts if part.function_call]
        text = "".join(part.text or "" for part in parts if not part.thought)
        if not calls:
            if not observed_call or nonce not in text:
                raise ValueError(f"No observed function-call/result-grounded answer; text={text!r}")
            sources = grounded_sources(candidate, text) if mixed else 0
            if mixed and not sources:
                raise ValueError(
                    f"Mixed tools accepted, but no observed search-grounded citation; text={text!r}"
                )
            return f"{MODEL}: structured smoke_probe call and returned nonce observed" + (
                f"; both tools enabled on every request, {sources} cited Web sources"
                if mixed
                else ""
            )
        if len(calls) != 1 or observed_call:
            raise ValueError("Expected one smoke_probe call; got repeated or multiple calls")
        call = calls[0]
        if call.name != "smoke_probe" or call.args != {"id": "exoscope-smoke"}:
            raise ValueError(f"Unexpected tool call: {call}")
        observed_call = True
        contents.extend(
            [
                content,  # Preserve function-call IDs and any thought signatures verbatim.
                types.Content(
                    role="tool",
                    parts=[
                        types.Part(
                            function_response=types.FunctionResponse(
                                id=call.id, name=call.name, response={"nonce": nonce}
                            )
                        )
                    ],
                ),
            ]
        )
    raise ValueError("Model did not finish within four requests")


def check_gemma(key: str, *, mixed: bool) -> str:
    if not key:
        raise ValueError("Missing GEMINI_API_KEY (or GOOGLE_API_KEY); live Gemma check unverified")
    with genai.Client(
        api_key=key,
        http_options=types.HttpOptions(
            timeout=60_000, retry_options=types.HttpRetryOptions(attempts=1)
        ),
    ) as client:

        def generate(
            contents: list[types.Content], tools: list[types.Tool]
        ) -> types.GenerateContentResponse:
            # SDK contents union includes optional PIL types without installed stubs.
            return client.models.generate_content(  # pyright: ignore[reportUnknownMemberType]
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=tools,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    tool_config=(
                        types.ToolConfig(include_server_side_tool_invocations=True)
                        if mixed
                        else None
                    ),
                    max_output_tokens=2048,
                ),
            )

        return exercise(generate, mixed=mixed)
