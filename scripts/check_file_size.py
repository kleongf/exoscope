#!/usr/bin/env python3
"""Fail if any source file exceeds MAX_LINES. Keeps god files from forming."""

import subprocess
import sys
from pathlib import Path

MAX_LINES = 300
SUFFIXES = {".py", ".ts", ".tsx"}
EXCLUDE = {"frontend/src/api/schema.ts"}


def tracked_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [Path(p) for p in out.splitlines() if Path(p).suffix in SUFFIXES and p not in EXCLUDE]


def main() -> int:
    too_big = [
        (path, n)
        for path in tracked_files()
        if path.exists() and (n := len(path.read_text().splitlines())) > MAX_LINES
    ]
    for path, n in too_big:
        print(f"{path}: {n} lines (max {MAX_LINES}). Split it by responsibility.")
    return 1 if too_big else 0


if __name__ == "__main__":
    sys.exit(main())
