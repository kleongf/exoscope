"""Shared audio → transcript → agent/tools → short spoken reply pipeline."""

from datetime import UTC, datetime

from exoscope.agent.models import ToolStep, TurnRequest, TurnResponse
from exoscope.agent.runner import run_agent
from exoscope.agent.timing import timed_step
from exoscope.project import Project, ProjectError, ProjectStore, StepRecord, record_turn
from exoscope.report.context import bind_project
from exoscope.report.locking import PROJECT_WRITES
from exoscope.voice import service as voice


def handle_turn(request: TurnRequest, projects: ProjectStore | None = None) -> TurnResponse:
    with PROJECT_WRITES:
        return _handle_turn(request, projects)


def _handle_turn(request: TurnRequest, projects: ProjectStore | None) -> TurnResponse:
    transcript = request.text or ""
    steps: list[ToolStep] = []
    if request.audio is not None:
        try:
            with timed_step("transcribe", steps, "Recognized speech."):
                transcript = voice.transcribe(request.audio)
        except voice.VoiceError as exc:
            return TurnResponse(transcript="", reply_text="", error=str(exc), steps=steps)
        except Exception:
            return TurnResponse(
                transcript="",
                reply_text="",
                error="Speech recognition failed. Please type instead.",
                steps=steps,
            )
    if not transcript.strip() or len(transcript) > 2000:
        return TurnResponse(
            transcript=transcript,
            reply_text="",
            error="The recognized text must contain 1-2000 characters. Please type instead.",
            steps=steps,
        )
    project, unsaved = open_project(request.project_id, projects)
    current = request.current_system or (project.current_system if project else None)
    with bind_project(project, projects, transcript, request.report_snapshot):
        result = run_agent(transcript, current)
    response = TurnResponse(transcript=transcript, **result.model_dump())
    response.steps = steps + response.steps
    if unsaved:
        response.warnings.append(unsaved)
    if project is not None and projects is not None:
        save_to_project(response, project, projects)
    if response.reply_text and not response.error:
        try:
            with timed_step("synthesize", response.steps, "Created spoken reply."):
                response.reply_audio = voice.synthesize(response.reply_text)
        except voice.VoiceError as exc:
            response.warnings.append(str(exc))
        except Exception:
            response.warnings.append(
                "Spoken reply unavailable; the text and System remain available."
            )
    return response


def open_project(
    project_id: str | None, projects: ProjectStore | None
) -> tuple[Project | None, str | None]:
    """The turn's Project, or a warning saying why this turn won't be saved to it."""
    if project_id is None or projects is None:
        return None, None
    try:
        return projects.load(project_id), None
    except ProjectError as exc:
        return None, f"This turn was not saved to the Project: {exc}"


def save_to_project(response: TurnResponse, project: Project, projects: ProjectStore) -> None:
    """Record the turn in its Project and save it. A failed save warns; it never fails the turn."""
    record_turn(
        project,
        response.transcript,
        response.reply_text,
        now=datetime.now(UTC),
        error=response.error,
        steps=[StepRecord.model_validate(s.model_dump()) for s in response.steps],
        system=response.data.system,
        comparison=response.data.comparison,
        sample=response.data.sample,
        web_search=response.data.web_search,
    )
    try:
        projects.save(project)
    except OSError as exc:
        response.warnings.append(f"This turn was not saved to the Project: {exc}")
        return
    response.project = project
