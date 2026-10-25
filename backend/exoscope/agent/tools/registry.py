"""Every tool Gemma may call. Add a tool by adding its module and one line here."""

from google.genai import types
from pydantic import BaseModel

from exoscope.agent.tools.base import Tool
from exoscope.agent.tools.compare import COMPARE
from exoscope.agent.tools.load_system import LOAD_SYSTEM
from exoscope.agent.tools.search_catalog import SEARCH_CATALOG
from exoscope.agent.tools.set_scene_view import SET_SCENE_VIEW

TOOLS: dict[str, Tool[BaseModel]] = {
    tool.name: tool  # pyright: ignore[reportAssignmentType]
    for tool in (LOAD_SYSTEM, COMPARE, SEARCH_CATALOG, SET_SCENE_VIEW)
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
