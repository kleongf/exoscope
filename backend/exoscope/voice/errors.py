"""Errors whose messages can safely be shown alongside the text fallback."""


class VoiceError(Exception):
    """A fixed public message, never an upstream body or credential."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code
