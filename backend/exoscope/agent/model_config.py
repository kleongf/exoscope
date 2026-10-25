"""Explicit hosted Gemma selection; never switch models during a tool conversation."""

import os

DEFAULT_MODEL = "gemma-4-26b-a4b-it"
SUPPORTED_MODELS = (DEFAULT_MODEL, "gemma-4-31b-it")


def gemma_model() -> str:
    """Read the engine model after dotenv loading; xAI search configures itself separately."""
    model = os.environ.get("GEMMA_MODEL", DEFAULT_MODEL).strip()
    if model not in SUPPORTED_MODELS:
        raise ValueError("GEMMA_MODEL must name a supported hosted Gemma 4 model.")
    return model
