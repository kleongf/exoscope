"""The manual scope picker and immutable Report HTML delivery."""

from fastapi import HTTPException
from fastapi.responses import FileResponse

from exoscope.project import Project, ProjectCorruptError, ProjectNotFoundError, ProjectStore
from exoscope.report.locking import PROJECT_WRITES
from exoscope.report.models import ReportRequest
from exoscope.report.selection import ReportError
from exoscope.report.service import export_report, report_path


def write_report(project_id: str, request: ReportRequest, projects: ProjectStore) -> Project:
    try:
        with PROJECT_WRITES:
            project = projects.load(project_id)
            return export_report(project, projects, request)
    except ProjectNotFoundError as exc:
        raise HTTPException(404, str(exc)) from None
    except ProjectCorruptError as exc:
        raise HTTPException(409, str(exc)) from None
    except ReportError as exc:
        raise HTTPException(422, str(exc)) from None


def read_report(filename: str, projects: ProjectStore, *, download: bool = False) -> FileResponse:
    try:
        path = report_path(projects, filename)
    except ReportError:
        raise HTTPException(404, "Unknown Report file.") from None
    if not path.is_file():
        raise HTTPException(404, "Unknown Report file.")
    return FileResponse(
        path,
        media_type="text/html",
        filename=filename,
        content_disposition_type="attachment" if download else "inline",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
