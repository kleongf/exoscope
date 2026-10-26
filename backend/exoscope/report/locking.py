"""Serialize Report appends with turn read/modify/save operations in this local app."""

from threading import RLock

PROJECT_WRITES = RLock()
