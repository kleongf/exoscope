"""Every tool Gemma may call. Add a tool by adding its module and one line here."""

from google.genai import types
from pydantic import BaseModel

from exoscope.agent.tools.base import Tool
from exoscope.agent.tools.compare import COMPARE
from exoscope.agent.tools.load_system import LOAD_SYSTEM

TOOLS: dict[str, Tool[BaseModel]] = {
    tool.name: tool  # pyright: ignore[reportAssignmentType]
    for tool in (LOAD_SYSTEM, COMPARE)
}


def declaration() -> types.Tool:
    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name=tool.name,
                description=tool.description,
                parameters_json_schema=tool.arguments.model_json_schema(),
            )
            for tool in TOOLS.values()
        ]
    )
