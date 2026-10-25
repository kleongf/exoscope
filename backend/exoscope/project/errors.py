"""Honest Project failures. Messages are shown to the student as they are."""


class ProjectError(Exception):
    """A Project could not be loaded or saved."""


class ProjectNotFoundError(ProjectError):
    """No Project file has this ID."""


class ProjectCorruptError(ProjectError):
    """The Project file exists but is not a valid Project."""
