"""Run all checks independently and redact credentials at the single output boundary."""

import argparse
import json
import logging
import os
import re
from collections.abc import Callable, Mapping
from pathlib import Path
from urllib.parse import quote

from dotenv import dotenv_values

from exoscope.service_smoke.gemma import check_gemma
from exoscope.service_smoke.voice import PHRASE, check_voice

ROOT = Path(__file__).resolve().parents[3]


def configuration(path: Path) -> dict[str, str]:
    # Explicit path only: never search a parent directory or copy its secrets.
    values = dotenv_values(dotenv_path=path, interpolate=False) if path.is_file() else {}
    return {key: value for key, value in {**values, **os.environ}.items() if value}


def redact(message: str, config: Mapping[str, str]) -> str:
    for key, value in sorted(config.items(), key=lambda pair: len(pair[1]), reverse=True):
        if any(word in key.upper() for word in ("KEY", "TOKEN", "SECRET", "PASSWORD")):
            for encoded in (value, quote(value, safe=""), json.dumps(value)[1:-1]):
                message = message.replace(encoded, "[REDACTED]")
    message = re.sub(r"(?i)bearer\s+[^\s\"',}]+", "Bearer [REDACTED]", message)
    # Prevent terminal-control or injected newlines from forging PASS output.
    return "".join(char if char.isprintable() else " " for char in message)[:2400]


def run_checks(checks: list[tuple[str, Callable[[], str]]], config: Mapping[str, str]) -> int:
    failures = 0
    for label, check in checks:
        try:
            detail = check()
        except Exception as error:  # Each service must still run after another fails.
            failures += 1
            status = "FAIL"
            detail = f"{type(error).__name__}: {error}"
        else:
            status = "PASS"
        print(f"{status} {label}: {redact(detail, config)}", flush=True)
        if label.startswith("1 ") and status == "FAIL":
            print(
                "Agent design blocked: Gemma function-call round-trip is not verified.", flush=True
            )
    return int(failures > 0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/service-smoke")
    parser.add_argument(
        "--audio", type=Path, help="Optional short speech clip instead of a TTS seed"
    )
    parser.add_argument("--expected-transcript", default=PHRASE)
    args = parser.parse_args()
    # SDK request logging must never bypass the redacted output boundary.
    logging.disable(logging.CRITICAL)
    try:
        config = configuration(args.env_file)
    except Exception as error:
        print(f"FAIL configuration: {type(error).__name__}; could not read explicit dotenv path")
        return 1
    gemini = config.get("GEMINI_API_KEY") or config.get("GOOGLE_API_KEY", "")
    xai = config.get("XAI_API_KEY", "")
    checks: list[tuple[str, Callable[[], str]]] = [
        ("1 Gemma function/result", lambda: check_gemma(gemini, mixed=False)),
        ("2 Gemma mixed search/functions", lambda: check_gemma(gemini, mixed=True)),
        (
            "3 Grok STT/TTS",
            lambda: check_voice(xai, args.output_dir, args.audio, args.expected_transcript),
        ),
    ]
    return run_checks(checks, config)


if __name__ == "__main__":
    raise SystemExit(main())
