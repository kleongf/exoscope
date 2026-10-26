"""Every tool the model may call. Add a tool by adding its module and one line here."""

from pydantic import BaseModel

from exoscope.agent.tools.base import Tool
from exoscope.agent.tools.compare import COMPARE
from exoscope.agent.tools.load_system import LOAD_SYSTEM
from exoscope.agent.tools.reports import EXPORT_REPORT, LIST_PROJECT_ITEMS
from exoscope.agent.tools.search_catalog import SEARCH_CATALOG
from exoscope.agent.tools.set_scene_view import SET_SCENE_VIEW
from exoscope.agent.tools.web_search import WEB_SEARCH

TOOLS: dict[str, Tool[BaseModel]] = {
    tool.name: tool  # pyright: ignore[reportAssignmentType]
    for tool in (
        LOAD_SYSTEM,
        COMPARE,
        SEARCH_CATALOG,
        SET_SCENE_VIEW,
        WEB_SEARCH,
        LIST_PROJECT_ITEMS,
        EXPORT_REPORT,
    )
}


def tool_definitions() -> list[dict[str, object]]:
    """Responses API function tools. Not strict: Pydantic schemas keep optional fields."""
    return [
        {
            "type": "function",
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.arguments.model_json_schema(),
            "strict": False,
        }
        for tool in TOOLS.values()
    ]
