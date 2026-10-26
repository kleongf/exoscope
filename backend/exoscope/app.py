"""FastAPI entrypoint. Routes stay thin; logic lives in feature modules."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from exoscope.agent.environment import load_environment
from exoscope.agent.turn import TurnRequest, TurnResponse, handle_turn
from exoscope.project import (
    Project,
    ProjectCorruptError,
    ProjectNotFoundError,
    ProjectStore,
    ProjectSummary,
    projects_dir,
)
from exoscope.report.models import ReportRequest
from exoscope.report.routes import read_report, write_report

load_environment()

app = FastAPI(title="ExoScope")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Health(BaseModel):
    status: str


@app.get("/health")
def health() -> Health:
    return Health(status="ok")


def get_projects() -> ProjectStore:
    return ProjectStore(projects_dir())


Projects = Annotated[ProjectStore, Depends(get_projects)]


class NewProject(BaseModel):
    name: str | None = Field(default=None, max_length=120)


@app.post("/turn")
def turn(request: TurnRequest, projects: Projects) -> TurnResponse:
    return handle_turn(request, projects)


@app.get("/projects")
def list_projects(projects: Projects) -> list[ProjectSummary]:
    return projects.list()


@app.post("/projects")
def create_project(body: NewProject, projects: Projects) -> Project:
    return projects.create(body.name, now=datetime.now(UTC))


@app.get("/projects/{project_id}", responses={404: {}, 409: {}})
def load_project(project_id: str, projects: Projects) -> Project:
    try:
        return projects.load(project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(404, str(exc)) from None
    except ProjectCorruptError as exc:
        raise HTTPException(409, str(exc)) from None


@app.post("/projects/{project_id}/reports", responses={404: {}, 409: {}, 422: {}})
def create_report(project_id: str, body: ReportRequest, projects: Projects) -> Project:
    return write_report(project_id, body, projects)


@app.get("/reports/{filename}", responses={404: {}}, response_class=FileResponse)
def get_report(filename: str, projects: Projects, download: bool = False) -> FileResponse:
    return read_report(filename, projects, download=download)
