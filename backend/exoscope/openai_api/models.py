"""OpenAI model names. Text models are read from env at call time; audio models are fixed."""

import os

DEFAULT_AGENT_MODEL = "gpt-6-luna"
# OpenAI's web-search docs list gpt-4.1-mini as supported and do not mention gpt-6-luna.
DEFAULT_SEARCH_MODEL = "gpt-4.1-mini"
STT_MODEL = "gpt-transcribe"
# Deprecated by OpenAI; shuts down 2027-01-06. The successor is the Realtime API.
TTS_MODEL = "gpt-4o-mini-tts"
TTS_VOICE = "coral"


def agent_model() -> str:
    return os.environ.get("OPENAI_AGENT_MODEL", "").strip() or DEFAULT_AGENT_MODEL


def search_model() -> str:
    return os.environ.get("OPENAI_SEARCH_MODEL", "").strip() or DEFAULT_SEARCH_MODEL
