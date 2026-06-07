#!/usr/bin/env python
"""
undoom — command-line client for the Un-doomed Socratic reviewer.
=================================================================

Run a Socratic code review from your terminal:

    undoom check Solution.java
    undoom check script.py --task "Implement binary search over a sorted list"

(If you haven't set up the `undoom` shortcut yet, use `python cli.py check ...`.)

What it does
------------
1. Reads the file you point it at.
2. Loads your provider / model / API key from ~/.undoomed_config.json
   (prompting you once, securely, on first run and saving the file).
3. Keeps a per-project `thread_id` in a `.undoomed_session` file in the CURRENT
   directory, so repeated checks on the same project increment the loop counter.
4. POSTs everything to the local server (http://127.0.0.1:8000/api/review).
5. Prints the Socratic hints (or the style review once your logic is clean) as
   pretty `rich` panels with Markdown.

Requires: pip install click rich requests   (plus a running Un-doomed server)
"""

import json
import os
import uuid
from pathlib import Path

import click
import requests
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.text import Text

# ----------------------------------------------------------------------------
#  >>> WHERE THE BACKEND LIVES — change this when you deploy <<<
#  Local development : http://127.0.0.1:8000
#  Production        : set the UNDOOMED_API_URL env var, or edit the default.
#    e.g.  export UNDOOMED_API_URL=https://undoomed-backend.onrender.com
# ----------------------------------------------------------------------------
API_BASE_URL = os.environ.get("UNDOOMED_API_URL", "http://127.0.0.1:8000")
API_URL = API_BASE_URL.rstrip("/") + "/api/review"

CONFIG_PATH = Path.home() / ".undoomed_config.json"   # global: provider + key
SESSION_FILE = Path(".undoomed_session")              # per-project: thread_id
DEFAULT_TASK = "Review this code for logic and edge cases"

PROVIDERS = ["openai", "anthropic", "gemini", "deepseek"]
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-opus-4-8",
    "gemini": "gemini-2.0-flash",
    "deepseek": "deepseek-chat",
}

console = Console()


# ---------------------------------------------------------------------------
# Configuration (~/.undoomed_config.json)
# ---------------------------------------------------------------------------
def _prompt_and_save_config() -> dict:
    """Interactively collect provider/model/key and persist them."""
    console.print(
        Panel(
            "First-time setup — let's save your AI provider and API key.\n"
            f"They'll be stored in [bold]{CONFIG_PATH}[/].",
            title="Un-doomed setup",
            border_style="cyan",
        )
    )
    provider = Prompt.ask("Provider", choices=PROVIDERS, default="openai")
    default_model = DEFAULT_MODELS[provider]
    model = Prompt.ask(f"Model (blank = {default_model})", default="", show_default=False)
    api_key = Prompt.ask("API key", password=True)  # hidden input
    server_secret = Prompt.ask(
        "Server password (optional — only if your backend requires one)",
        password=True,
        default="",
        show_default=False,
    )

    config = {
        "provider": provider,
        "model": model.strip(),
        "api_key": api_key.strip(),
        "server_secret": server_secret.strip(),
    }
    _save_config(config)
    return config


def _save_config(config: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
    # Best-effort: lock the file down to the owner (no-op / harmless on Windows).
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass
    console.print(f"[green]Saved config to[/] {CONFIG_PATH}\n")


def load_or_create_config() -> dict:
    """Return a valid config, prompting + saving on first run or if corrupt."""
    if CONFIG_PATH.exists():
        try:
            config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            if config.get("api_key") and config.get("provider"):
                return config
            console.print("[yellow]Config is missing a provider or key — let's redo it.[/]")
        except (json.JSONDecodeError, OSError):
            console.print("[yellow]Config file is unreadable — let's set it up again.[/]")
    return _prompt_and_save_config()


# ---------------------------------------------------------------------------
# Per-project session (./.undoomed_session)
# ---------------------------------------------------------------------------
def get_thread_id() -> str:
    """Reuse this project's thread_id, or mint and save a new one."""
    if SESSION_FILE.exists():
        existing = SESSION_FILE.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    thread_id = "cli_" + uuid.uuid4().hex[:12]
    SESSION_FILE.write_text(thread_id, encoding="utf-8")
    return thread_id


# ---------------------------------------------------------------------------
# Pretty output
# ---------------------------------------------------------------------------
def render(data: dict, filename: Path, thread_id: str) -> None:
    status = data.get("status", "pending")
    loop_count = data.get("loop_count", 0)
    faults = data.get("edge_case_faults") or []

    console.print()  # breathing room

    if status == "approved":
        console.print(
            Panel(
                Markdown(data.get("style_feedback") or "_No feedback returned._"),
                title="✅  Approved — Style Review",
                border_style="green",
                subtitle=f"{filename.name} | attempts: {loop_count}",
            )
        )
        return

    # Needs revision: show the faults, then the Socratic hints.
    if faults:
        fault_md = "\n".join(f"- {fault}" for fault in faults)
        console.print(
            Panel(
                Markdown(fault_md),
                title="⚠  Edge-case faults found",
                border_style="yellow",
            )
        )

    console.print(
        Panel(
            Markdown(data.get("socratic_hints") or "_No hints returned._"),
            title="🤔  Socratic Hints",
            border_style="magenta",
            subtitle=f"{filename.name} | attempt #{loop_count}",
        )
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
@click.group()
@click.version_option("1.0.0", prog_name="undoom")
def cli() -> None:
    """Un-doomed - Socratic code review from your terminal."""


@cli.command()
@click.argument(
    "filename",
    type=click.Path(exists=True, dir_okay=False, readable=True, path_type=Path),
)
@click.option("--task", default=DEFAULT_TASK, show_default=True,
              help="Describe what the code is supposed to do.")
@click.option("--reset-config", is_flag=True,
              help="Forget the saved provider/key and set them up again.")
def check(filename: Path, task: str, reset_config: bool) -> None:
    """Review the code in FILENAME and print Socratic hints or a style review."""
    if reset_config and CONFIG_PATH.exists():
        CONFIG_PATH.unlink()

    config = load_or_create_config()

    code = filename.read_text(encoding="utf-8", errors="replace")
    if not code.strip():
        console.print(f"[red]{filename} is empty — nothing to review.[/]")
        raise SystemExit(1)

    thread_id = get_thread_id()

    payload = {
        "task_description": task,
        "current_code": code,
        "thread_id": thread_id,
        "provider": config.get("provider"),
        "model": config.get("model") or "",
        "api_key": config.get("api_key"),
    }

    # Send the shared secret only if one was configured (open servers ignore it).
    req_headers = {}
    if config.get("server_secret"):
        req_headers["X-Server-Secret"] = config["server_secret"]

    header = Text.assemble(
        ("Un-doomed", "bold magenta"),
        ("  |  ", "dim"),
        (f"{filename.name}", "bold"),
        ("  |  ", "dim"),
        (f"{config.get('provider')}", "cyan"),
    )
    console.print(header)

    try:
        with console.status("[bold]Reviewing your code…", spinner="dots"):
            response = requests.post(API_URL, json=payload, headers=req_headers, timeout=120)
    except requests.exceptions.ConnectionError:
        console.print(
            Panel(
                "Couldn't reach the Un-doomed server at 127.0.0.1:8000.\n"
                "Start it first:  [bold]undoom serve[/]",
                title="Connection error",
                border_style="red",
            )
        )
        raise SystemExit(1)
    except requests.exceptions.RequestException as exc:
        console.print(Panel(str(exc), title="Request failed", border_style="red"))
        raise SystemExit(1)

    if response.status_code != 200:
        detail = f"HTTP {response.status_code}"
        try:
            body = response.json()
            if body.get("detail"):
                detail = body["detail"]
        except ValueError:
            pass
        console.print(Panel(detail, title=f"Server error {response.status_code}", border_style="red"))
        raise SystemExit(1)

    render(response.json(), filename, thread_id)


@cli.command()
@click.option("--host", default="127.0.0.1", show_default=True, help="Host to bind.")
@click.option("--port", default=8000, show_default=True, type=int, help="Port to bind.")
@click.option("--reload", is_flag=True, help="Auto-reload on code changes (dev only).")
def serve(host: str, port: int, reload: bool) -> None:
    """Start the Un-doomed backend server (the API the clients talk to)."""
    try:
        import uvicorn
    except ImportError:
        console.print("[red]uvicorn isn't installed. Run:[/] pip install -e .")
        raise SystemExit(1)

    console.print(
        Panel(
            f"Un-doomed server starting on [bold]http://{host}:{port}[/]\n"
            f"Interactive docs: http://{host}:{port}/docs   (Ctrl+C to stop)",
            border_style="cyan",
        )
    )
    # Import string form so --reload works; the DB lands in the current directory.
    uvicorn.run("undoomed.server:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    cli()
