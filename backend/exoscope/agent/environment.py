"""Explicit environment loading; never walk into a parent directory for secrets."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]


def load_environment() -> None:
    configured = os.environ.get("EXOSCOPE_ENV_FILE")
    path = Path(configured).expanduser() if configured else ROOT / ".env"
    # Relative explicit paths are relative to the repository, irrespective of cwd.
    if not path.is_absolute():
        path = ROOT / path
    load_dotenv(dotenv_path=path, override=False, interpolate=False)
