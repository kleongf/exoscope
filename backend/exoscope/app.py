"""FastAPI entrypoint. Routes stay thin; logic lives in feature modules."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from exoscope.agent.turn import TurnRequest, TurnResponse, handle_turn

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


@app.post("/turn")
def turn(request: TurnRequest) -> TurnResponse:
    return handle_turn(request)
