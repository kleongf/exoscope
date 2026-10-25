"""Project operations use /turn without calling Gemma or voice providers."""

from exoscope.agent.models import TurnResponse
from exoscope.project.models import ProjectAction
from exoscope.project.storage import ProjectError, execute


def handle_project_action(action: ProjectAction) -> TurnResponse:
    try:
        return TurnResponse(transcript="", reply_text="", project_result=execute(action))
    except ProjectError as exc:
        return TurnResponse(transcript="", reply_text="", error=str(exc))
