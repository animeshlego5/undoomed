# syntax=docker/dockerfile:1
# =============================================================================
# Production image for the Un-doomed FastAPI / LangGraph backend.
# Built for container hosts like Render, Railway, or Fly.io.
# =============================================================================
FROM python:3.12-slim

# Lean, predictable Python in containers.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Copy only what's needed to install the package. NOTE: pyproject.toml's
# `readme = "README.md"` means that file must be present at build time.
COPY pyproject.toml README.md ./
COPY src/ ./src/

# Install the package WITH every provider, so a client can choose any of
# openai / anthropic / gemini / deepseek at request time.
RUN pip install --upgrade pip && pip install ".[all]"

# Run as a non-root user (good practice). /app is the working directory where
# the SQLite memory file is written, so it must be writable by this user.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Render / Railway inject $PORT and route traffic to it. Default to 8000 locally.
ENV PORT=8000
EXPOSE 8000

# PERSISTENCE NOTE: undoomed_state.db is written to the working dir, which is
# EPHEMERAL on most platforms (wiped on each redeploy). For durable memory,
# attach a persistent disk and point the DB at it, e.g.:
#     UNDOOMED_DB=/data/undoomed_state.db   (with a volume mounted at /data)
# (The backend does NOT need provider API keys in its env — each client sends
#  its own key per request. Set keys only if you want a server-side fallback.)

# Optional liveness probe (hosting platforms often use their own).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health')" || exit 1

# Shell form so ${PORT} expands at runtime; bind 0.0.0.0 so it's reachable.
CMD uvicorn undoomed.server:app --host 0.0.0.0 --port ${PORT:-8000}
