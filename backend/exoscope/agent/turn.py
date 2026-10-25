"""Shared audio → transcript → agent/tools → short spoken reply pipeline."""

from exoscope.agent.models import ToolStep, TurnRequest, TurnResponse
from exoscope.agent.runner import run_agent
from exoscope.agent.timing import timed_step
from exoscope.project.turn import handle_project_action
from exoscope.voice import service as voice


def handle_turn(request: TurnRequest) -> TurnResponse:
    if request.project_action is not None:
        return handle_project_action(request.project_action)
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
    result = run_agent(transcript, request.current_system)
    response = TurnResponse(transcript=transcript, **result.model_dump())
    response.steps = steps + response.steps
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
