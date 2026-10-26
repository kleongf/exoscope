"""OpenAI: the only provider for the agent, voice and web search."""

from exoscope.openai_api.client import (
    BASE_URL,
    OpenAIUnavailableError,
    failure_message,
    openai_client,
    openai_key,
)
from exoscope.openai_api.models import (
    STT_MODEL,
    TTS_MODEL,
    TTS_VOICE,
    agent_model,
    search_model,
)

__all__ = [
    "BASE_URL",
    "STT_MODEL",
    "TTS_MODEL",
    "TTS_VOICE",
    "OpenAIUnavailableError",
    "agent_model",
    "failure_message",
    "openai_client",
    "openai_key",
    "search_model",
]
