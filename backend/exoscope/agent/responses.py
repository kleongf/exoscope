"""Read an OpenAI Responses API result: the function calls it asks for, or its final text."""

from typing import cast

from pydantic import BaseModel

Item = dict[str, object]


class FunctionCall(BaseModel):
    call_id: str
    name: str
    arguments: str = "{}"


def output_items(response: dict[str, object]) -> list[Item]:
    output = response.get("output")
    if not isinstance(output, list):
        raise ValueError("No model output")
    return [cast(Item, item) for item in cast(list[object], output) if isinstance(item, dict)]


def function_calls(items: list[Item]) -> list[FunctionCall]:
    return [FunctionCall.model_validate(i) for i in items if i.get("type") == "function_call"]


def final_text(items: list[Item]) -> str:
    texts: list[str] = []
    for item in items:
        if item.get("type") != "message":
            continue
        for part in cast(list[object], item.get("content") or []):
            if isinstance(part, dict):
                part = cast(Item, part)
                if part.get("type") == "output_text" and isinstance(part.get("text"), str):
                    texts.append(cast(str, part["text"]))
    return "".join(texts).strip()
