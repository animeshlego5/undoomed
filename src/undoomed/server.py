"""
Un-doomed :: FastAPI service layer
==================================

Thin HTTP wrapper around the compiled LangGraph review workflow defined in
``socratic_reviewer.py``. Client extensions / CLIs POST a code submission to
``/api/review`` and receive back the graph's final review state.

State (including ``loop_count``) is persisted by the graph's durable
``SqliteSaver`` checkpointer (an on-disk ``undoomed_state.db``), keyed by the
``thread_id`` supplied in each request. So a client can call this endpoint
repeatedly for the same student session -- and the loop counter / escalation
behaviour survives not just across requests but across full process restarts.

Run it (after `pip install -e .`):
    undoom serve                      # or: uvicorn undoomed.server:app --reload
    # interactive docs at http://127.0.0.1:8000/docs
"""

from __future__ import annotations

# IMPORTANT: load environment variables BEFORE importing socratic_reviewer.
# That module instantiates a ChatOpenAI client at import time, which reads
# OPENAI_API_KEY from the environment. If we imported first, a missing key in
# the process env (but present in .env) would blow up at import.
from dotenv import load_dotenv

load_dotenv()

import os  # noqa: E402
import sqlite3  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
from typing import List  # noqa: E402  (kept after load_dotenv on purpose)

from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from langgraph.checkpoint.sqlite import SqliteSaver  # noqa: E402

from .socratic_reviewer import build_graph, build_llm  # noqa: E402


# ---------------------------------------------------------------------------
# Durable persistence layer (SQLite)
# ---------------------------------------------------------------------------
# Put the checkpoint DB in the current working directory (where you launch the
# server), NOT next to this module -- the package now lives under src/ (or, once
# installed, in site-packages) and we don't want to write data there. Launch the
# server from your project root and the DB lives there. Override with UNDOOMED_DB.
DB_PATH = os.environ.get(
    "UNDOOMED_DB", os.path.join(os.getcwd(), "undoomed_state.db")
)

# One shared SQLite connection for the lifetime of the process.
#   check_same_thread=False: FastAPI executes sync endpoints in a threadpool,
#   so this connection is touched from multiple worker threads. SqliteSaver
#   serialises access with an internal lock, so cross-thread use is safe here.
conn = sqlite3.connect(DB_PATH, check_same_thread=False)

# SqliteSaver writes every checkpoint thread to disk, keyed by thread_id, so
# loop_count and the full review history survive process restarts.
checkpointer = SqliteSaver(conn)

# Create the checkpoint tables up front (idempotent). This guarantees the DB
# is initialised cleanly at startup rather than lazily on the first request.
checkpointer.setup()

# Compile the LangGraph app ONCE against the durable checkpointer and reuse it
# for every request.
graph = build_graph(checkpointer=checkpointer)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage process-level resources.

    Startup work (DB connect + table setup + graph compile) already ran at
    import time above; on shutdown we close the SQLite connection cleanly so
    no file handle is leaked.
    """
    yield
    conn.close()


# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Un-doomed Socratic Reviewer API",
    description="Multi-agent code review with Socratic hinting and style critique.",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------
class ReviewRequest(BaseModel):
    """Payload sent by a client (extension / CLI) for a single submission."""

    task_description: str = Field(
        ..., description="The problem the student is solving."
    )
    current_code: str = Field(
        ..., description="The student's latest code submission."
    )
    thread_id: str = Field(
        ...,
        description=(
            "Stable per-student/session identifier. Reuse the same value across "
            "submissions to persist loop_count and the review history."
        ),
    )
    # Per-user credentials supplied by the extension's settings. All optional —
    # if omitted, the server falls back to its own .env (LLM_PROVIDER / keys).
    provider: str | None = Field(
        default=None,
        description="openai | anthropic | gemini | deepseek. Omit to use the server default.",
    )
    model: str | None = Field(
        default=None, description="Optional model-id override for the provider."
    )
    api_key: str | None = Field(
        default=None,
        description="API key for the chosen provider. Omit to use the server's env key.",
    )


class ReviewResponse(BaseModel):
    """The slice of final graph state returned to the client."""

    status: str = Field(description='"pending" | "needs_revision" | "approved".')
    socratic_hints: str = Field(
        default="", description="Socratic coaching (empty if code was clean)."
    )
    style_feedback: str = Field(
        default="",
        description="Big-O + PEP-8 review (only when logic is clean / approved).",
    )
    # Bonus fields beyond the required three -- handy for the client UI.
    loop_count: int = Field(
        default=0, description="Number of revision attempts on this thread."
    )
    edge_case_faults: List[str] = Field(
        default_factory=list,
        description="Logic/edge-case faults found this round (empty if clean).",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    """Lightweight liveness probe."""
    return {"status": "ok"}


@app.post("/api/review", response_model=ReviewResponse)
def review(req: ReviewRequest) -> ReviewResponse:
    """Run one review turn through the LangGraph workflow.

    We pass ONLY ``task_description`` and ``current_code`` as input. Everything
    else (loop_count, prior faults/hints) is restored from the checkpoint for
    this ``thread_id`` -- deliberately not sending loop_count keeps it from
    being reset, so it accumulates across requests.
    """
    configurable = {"thread_id": req.thread_id}

    # If the extension supplied credentials, build a client from them for THIS
    # request and hand it to the graph via config. Otherwise the nodes fall back
    # to the server's env-based client. A bad provider/missing package is the
    # caller's setup error -> 400, not a server fault.
    if req.api_key or req.provider or req.model:
        try:
            configurable["llm"] = build_llm(
                provider=req.provider, model=req.model, api_key=req.api_key
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Provider setup failed: {exc}") from exc

    inputs = {
        "task_description": req.task_description,
        "current_code": req.current_code,
    }

    try:
        final_state = graph.invoke(inputs, config={"configurable": configurable})
    except Exception as exc:  # surface model/graph errors as a clean 500.
        raise HTTPException(status_code=500, detail=f"Review failed: {exc}") from exc

    return ReviewResponse(
        status=final_state.get("status", "pending"),
        socratic_hints=final_state.get("socratic_hints", ""),
        style_feedback=final_state.get("style_feedback", ""),
        loop_count=final_state.get("loop_count", 0),
        edge_case_faults=final_state.get("edge_case_faults", []),
    )


if __name__ == "__main__":
    # Convenience launcher: `python -m undoomed.server`. For dev reloads prefer
    # `undoom serve --reload` or `uvicorn undoomed.server:app --reload`.
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
