# Un-doomed — Project Documentation

> A living document. It is updated with **every** prompt/change so anyone — even
> someone who has never written a line of code — can follow how the project
> works and how it got here. The newest changes are summarised in the
> **Change Log** at the bottom.

---

## 1. What is Un-doomed, in one paragraph?

Un-doomed is a friendly, strict coding tutor for students. When a student is
solving a programming problem (for example on the website **LeetCode**), they
can ask Un-doomed to review their code. Instead of just handing over the answer,
Un-doomed behaves like a good human teacher:

1. It first checks whether the code actually **works** for every situation
   (including tricky "edge cases" like empty inputs).
2. If something is broken, it gives **Socratic hints** — pointed *questions*
   that nudge the student to find the bug themselves. It deliberately refuses to
   write the code for them.
3. Only once the logic is correct does it comment on **style** — how clean,
   readable, and efficient the code is.

This protects students from the "doom" of either getting stuck forever or
copy-pasting an answer they don't understand. Hence: **Un-doomed**.

---

## 2. The big picture (how the pieces fit together)

The project has one **backend** ("the brain") and two **clients** that talk to it:

- **The backend ("the brain").** A program that runs on your own computer. It
  contains the three reviewer personalities and the logic that decides which one
  speaks. It talks to your chosen AI provider (OpenAI, Anthropic/Claude, Gemini,
  or DeepSeek) to do the actual reasoning.
- **The Chrome/Edge extension ("the messenger").** A small browser add-on. It
  sits on the LeetCode page, grabs the problem text and the student's code, sends
  them to the backend, and shows the reply in a tidy little panel.
- **The CLI client ("the terminal tool").** A Python command, `undoom check
  <file>`, that reviews a file straight from a developer's terminal and prints
  the answer with pretty formatting (see section 11).

Here is the whole journey of a single review, as a picture:

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Student's Chrome browser, on a LeetCode problem page                  │
  │                                                                        │
  │   [content.js] reads the problem text + code from the page             │
  │            │                                                           │
  │            ▼                                                           │
  │   [popup.js] bundles it with a "thread_id" and sends it off  ──────────┼──┐
  └──────────────────────────────────────────────────────────────────────┘  │
                                                                              │  POST /api/review
                                                                              ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Backend on your computer (http://127.0.0.1:8000)                      │
  │                                                                        │
  │   [server.py]  receives the request                                    │
  │        │                                                               │
  │        ▼                                                               │
  │   [socratic_reviewer.py]  the LangGraph "assembly line":               │
  │                                                                        │
  │     Executioner  ──found bugs?──►  Socratic Tutor  ──► reply (hints)    │
  │         │                                                              │
  │         └──── no bugs ──────────►  Clean-Code Critic ─► reply (style)   │
  │                                                                        │
  │   Memory (SQLite file) remembers each student by thread_id             │
  └──────────────────────────────────────────────────────────────────────┘
                                                                              │
                                       reply travels back the same way ◄──────┘
```

---

## 3. Plain-English glossary

You can skip this and refer back to it whenever a term is unfamiliar.

| Term | What it really means |
|------|----------------------|
| **AI model / LLM** | A "large language model" — the smart text engine (here, OpenAI's `gpt-4o-mini`) that reads and writes language. We give it instructions and it responds. |
| **Backend / server** | A program that runs quietly in the background, waiting to answer requests. It has no screen of its own; other programs talk to it. |
| **API** | "Application Programming Interface." A set of well-defined doorways one program uses to ask another program for something. |
| **Endpoint** | One specific doorway of an API, named like a web address. Ours is `/api/review`. |
| **Request / Response** | A "request" is a question sent to the server; a "response" is the answer it sends back. |
| **POST** | The type of request used when you are *sending data in* (the student's code), as opposed to merely fetching a page. |
| **JSON** | A simple text format for structured data, like a labelled form: `{ "name": "Alice", "age": 20 }`. Both halves of Un-doomed speak JSON to each other. |
| **Agent / node** | One of the three reviewer "personalities." In the code each is a small function called a *node*. |
| **LangGraph** | A toolkit for connecting several AI steps into a flowchart ("graph") with arrows and decision points. |
| **State** | A shared notebook that travels through the flowchart. Every step can read it and write to it. |
| **Checkpoint / persistence** | Saving that notebook so it survives even after the request ends — so the system *remembers* you next time. |
| **thread_id** | A name tag for one student's ongoing session, so the memory knows whose notebook to load. |
| **DOM** | The live structure of a web page that scripts can read (all the text, buttons, boxes you see). |
| **Monaco** | The code-editor component LeetCode uses (the same engine that powers VS Code). Reading code out of it needs a special trick — see §6.3. |
| **Chrome extension** | A small program that adds features to the Chrome browser. |
| **Manifest** | The extension's "ID card + permission slip" — a file that tells Chrome the extension's name and what it's allowed to do. |

---

## 4. Repository map (what each file is)

```
undoomed/
├─ README.md              # Project storefront / open-source landing (start here)
├─ LICENSE                # MIT license
├─ pyproject.toml          # Package config: deps + the `undoom` command entry point
├─ src/
│  └─ undoomed/            # The installable Python package
│     ├─ __init__.py
│     ├─ socratic_reviewer.py  # Backend brain: 3 reviewers + flowchart + demo
│     ├─ server.py             # Backend doorway: the FastAPI web API
│     └─ cli.py                # Terminal client: `undoom check` / `undoom serve`
│
├─ smoke_test.py          # End-to-end plumbing check (stdlib only)
├─ requirements.txt       # Legacy dep list (pyproject is now canonical)
├─ .env.example           # Template for the optional fallback .env (provider/key)
├─ undoomed_state.db      # (created on first run) the memory file (SQLite)
│
├─ manifest.json          # Browser extension ID card + permissions (Manifest V3)
├─ content.js             # Reads the page + draws the on-page results OVERLAY
├─ md.js                  # Safe Markdown→HTML renderer (shared by popup + overlay)
├─ config.js              # SHARED client config: the backend URL (one place to edit)
├─ popup.html / .css / .js     # The popup panel (scrape → send → show)
├─ options.html / .css / .js   # Settings page (provider + key + overlay + Test)
│
├─ agent.md               # Drop-in AI-assistant rules (Claude Code / Cursor)
├─ index.html             # The marketing landing page (Tailwind via CDN)
│
├─ vercel.json            # Vercel: serve the static frontend, skip any build
├─ .vercelignore          # Keeps the Python backend out of the Vercel deploy
├─ Dockerfile             # Production image for the backend (Render/Railway)
├─ .dockerignore          # Keeps secrets/data/frontend out of the image
├─ .github/               # CI workflow (ci.yml) + issue/PR templates
└─ documentation.md       # This file
```

(The CLI also creates two small files at runtime: `~/.undoomed_config.json` —
your saved provider/model/key — and a per-project `.undoomed_session` holding
that project's `thread_id`. An editable install also creates `src/undoomed.egg-info`.)

---

## 5. The backend in detail ("the brain")

### 5.1 The shared notebook — `ReviewState`

Everything the system knows about one review lives in a single shared record
called `ReviewState`. Think of it as a paper form that gets passed from
reviewer to reviewer. Its boxes:

- **task_description** — the problem the student is solving.
- **current_code** — the code the student just submitted.
- **edge_case_faults** — a list of logic problems found (empty list = no bugs).
- **socratic_hints** — the questions the tutor wrote back.
- **style_feedback** — the style/efficiency notes (filled only when code is clean).
- **status** — one of `"pending"`, `"needs_revision"`, or `"approved"`.
- **loop_count** — how many *revision attempts* this student has made.

### 5.2 The three reviewers (the "agents")

**1) The Edge-Case Executioner** (`edge_case_executioner`)
A ruthless senior engineer whose only job is to find where the code would give a
*wrong answer* — empty inputs, duplicates, "no solution exists," using the same
item twice, returning nothing, and so on. It is forced to answer in a strict
yes/no-plus-list format (`has_errors`, `issues`) so the rest of the flowchart
can trust its verdict. It does **not** care about style.

**2) The Socratic Tutor** (`socratic_tutor`)
Receives the list of faults and turns each one into a *question* that leads the
student to the discovery — never giving the fix outright. It is under a hard
rule: **no code, no code blocks, no pseudo-code.** There is one humane
exception: if the student has now tried **3 or more times** (`loop_count >= 3`),
the tutor appends a clear, plain-English **Direct Solution** so the student
isn't left frustrated forever.

**3) The Clean-Code Critic** (`clean_code_critic`)
Only speaks when the Executioner found **zero** bugs. Now that the logic is
trustworthy, it reviews *form*: the "Big-O" time/space efficiency and PEP-8
(Python's official style guide). It marks the work `approved`.

### 5.3 The flowchart and its one decision

The flow always starts at the **Executioner**. Then a single fork:

- **Found at least one fault?** → go to the **Socratic Tutor** → reply, done.
- **Found no faults?** → go to the **Clean-Code Critic** → reply, done.

So a student never gets style nitpicks while their code is still broken, and
never gets the answer handed to them while they can still figure it out.

### 5.4 The attempt counter rule (important!)

`loop_count` is increased **only inside the Socratic Tutor** — i.e. only when a
revision is actually needed. This was a deliberate design choice: a student who
writes correct code on the **first try** sails straight to the Critic and is
**never charged an attempt** (their count stays 0). The counter only climbs when
someone genuinely needs another round of hints, which is exactly what drives the
"give the direct answer after 3 tries" safety valve.

### 5.5 How it remembers you — persistence

The flowchart is "compiled" with a **checkpointer**, which saves the shared
notebook after each run, filed under the student's `thread_id`.

- For the standalone demo inside `socratic_reviewer.py`, an in-memory saver is
  used (forgotten when the program closes) — fine for a quick test.
- For the real server, we use a **durable `SqliteSaver`** that writes to a file
  called **`undoomed_state.db`** on disk. Because it's a file, the memory
  survives even a full restart of the server: a student can come back tomorrow,
  on the same `thread_id`, and their attempt count and history are still there.

### 5.6 The web doorway — `server.py`

`server.py` uses **FastAPI** to expose the brain over the web on your own
machine at `http://127.0.0.1:8000`.

- On startup it opens the SQLite memory file, creates its tables cleanly, builds
  the flowchart against that durable memory, and (on shutdown) closes the file
  neatly.
- It offers two doorways:
  - `GET /health` — a simple "are you alive?" check that replies `{"status":"ok"}`.
  - `POST /api/review` — the real one. You send it
    `{ task_description, current_code, thread_id }`, and it returns
    `{ status, socratic_hints, style_feedback, loop_count, edge_case_faults }`.
- It only forwards `task_description` and `current_code` into the flowchart and
  **deliberately does not send `loop_count`** — that way the saved value keeps
  accumulating instead of being reset on every request.

A note for the future: this setup runs as a single process, which is exactly
right for the current local deployment. (If it were ever scaled to many parallel
worker processes, the SQLite memory would need to be shared between them — but
that is intentionally out of scope for now.)

---

## 6. The Chrome extension in detail ("the messenger")

### 6.1 What a Chrome extension is

A Chrome extension is a tiny bundle of files Chrome loads to add a feature. Ours
adds a toolbar button; clicking it opens a small **popup panel**. The extension
follows **Manifest V3**, the current standard Google requires.

### 6.2 `manifest.json` — the ID card and permission slip

This file tells Chrome:

- The extension's **name**, **version**, and **description**.
- Its **permissions** — the abilities it needs:
  - `storage` — to save the `thread_id` so it persists between visits.
  - `activeTab` — to act on the tab the user is currently looking at.
  - `scripting` — to run a small reader function inside the page (needed to grab
    the code from Monaco; see below).
- Its **host permissions** — the websites it may talk to:
  - `https://leetcode.com/*` — to read the problem pages.
  - `http://127.0.0.1:8000/*` — to reach your local backend.
- Its **action** — that clicking the toolbar icon opens `popup.html`.
- Its **content script** — that `content.js` should be auto-loaded on any
  `https://leetcode.com/problems/*` page.

### 6.3 `content.js` — the page reader (and the Monaco challenge)

This script runs *inside* the LeetCode page and reads two things:

1. **The problem description.** Straightforward: it looks through a list of
   likely page locations (LeetCode renames its internal labels often, so we try
   several) and grabs the title + statement text.

2. **The student's code — the tricky part.** LeetCode's editor is **Monaco**.
   Two complications:
   - Monaco only keeps the *visible* lines in the page structure (it "recycles"
     off-screen lines to stay fast). So simply reading the visible text can miss
     code that's scrolled out of view.
   - The complete, accurate code lives in Monaco's own memory
     (`window.monaco`), but a content script runs in a walled-off "isolated
     world" and is **not allowed to touch the page's own JavaScript** there.

   **The robust solution** (implemented in `popup.js`, see §6.5): use Chrome's
   `scripting` ability to run a tiny reader function in the page's **main
   world**, where `window.monaco` *is* reachable, and ask it directly for the
   full code. `content.js` keeps a simpler **DOM-based reading as a fallback**
   in case that ever fails. Belt and suspenders.

`content.js` waits for a message (`UNDOOMED_SCRAPE`) from the popup and replies
with `{ task_description, current_code }`. Since Prompt 16 it does much more —
it also draws the **on-page results overlay** and manages **per-problem
history** (see §6.6).

### 6.4 `popup.html` + `popup.css` — the panel

`popup.html` is the *structure* of the panel:

- a small brand header ("Un-doomed — Hints, not answers."),
- one button: **"Request Socratic Review,"**
- a status line for progress/errors,
- a result card that shows either the **Socratic Hints** or the **Style Review**,
  with a little colored pill saying "Needs revision" or "Approved,"
- a footer showing the session id.

Since Prompt 16 the results normally appear in the **on-page overlay** (§6.6);
the popup's own card is the fallback when the overlay is turned off. Either way
the text is now rendered from Markdown into clean headings, lists, and code (via
`md.js`) instead of being shown raw.

`popup.css` is the *looks*. It follows the Un-doomed brand: a calm near-white
background, a single restrained indigo accent, soft rounded corners, generous
spacing, and no clutter.

### 6.5 `popup.js` — the logic that ties it together

When the user clicks the button, `popup.js`:

1. **Builds a per-problem `thread_id`.** A unique per-browser id is created once
   and saved with `chrome.storage.local`; the actual thread id is that id plus
   the problem's slug (`<your-id>__<slug>`). So the backend keeps a *separate*
   attempt count and memory for each problem (since Prompt 16 — previously one
   counter was shared across all problems).
2. **Checks** that the active tab really is a LeetCode problem page.
3. **Reads the full code *and the selected language*** by running the tiny reader
   in the page's main world (the Monaco trick from §6.3). The language is
   Monaco's own id, e.g. `java`/`python`/`cpp`.
4. **Asks `content.js`** for the problem description (and a fallback copy of the
   code).
5. **Sends** `{ task_description, current_code, language, thread_id, … }` as a
   POST request to the backend.
6. **Shows the reply.** If `status` is `approved`, it's the **Style Review**;
   otherwise the **Socratic Hints**. The result is handed to the on-page overlay
   (§6.6) and saved to history; if the overlay is off or unreachable, it renders
   in the popup card instead. All output is escaped before any Markdown
   formatting is applied, so a response can never inject markup.
7. **Handles problems gracefully** — e.g. if the backend isn't running, it shows
   a clear "Is the server running?" message instead of failing silently.

### 6.6 The on-page overlay + history (`content.js`, `md.js`)

From Prompt 16, results appear in a roomy panel drawn directly on the LeetCode
page rather than only in the cramped popup:

- **Where it lives:** `content.js` injects the panel into a **Shadow DOM** — an
  isolated mini-document — so LeetCode's CSS can't distort it and its CSS can't
  affect the page. A small floating **"⏻ Un-doomed"** button (bottom-right)
  opens and closes it.
- **What it shows:** a **Current** tab with the latest review (rendered Markdown:
  headings, lists, `code`, and code blocks) plus a status pill and a meta line
  (language · attempt # · time), and a **History** tab.
- **History / no wasted tokens:** every review is cached in
  `chrome.storage.local` under a key unique to that problem. The History tab
  lists past reviews; clicking one re-opens it **instantly with no API call**.
  This persists across closing the popup *and* reloading the page (the launcher
  even shows a badge with how many saved reviews exist), so you never have to
  re-run a review — and re-spend tokens — just to re-read an answer.
- **The toggle:** Settings has **"Show results as an on-page overlay"** (default
  on). Turn it off to use the in-popup card instead.
- **`md.js`:** a tiny, dependency-free, safe Markdown→HTML renderer shared by the
  popup and the overlay. It escapes all HTML first and then adds only a fixed,
  known set of tags, so model output cannot inject scripts or arbitrary markup.

---

## 7. How to run the whole thing (step by step)

**A. Install the package + start the backend (one-time setup, then run):**

1. Install Un-doomed in editable mode (this also installs every dependency and
   creates the global `undoom` command):
   `pip install -e .`
   To add another AI provider's library at the same time, use an extra, e.g.
   `pip install -e ".[anthropic]"` (or `.[gemini]`, `.[deepseek]`, `.[all]`).
2. (Optional) For the `.env` fallback, put a key in `.env` next to `pyproject.toml`:
   `OPENAI_API_KEY=sk-...` (the extension/CLI Settings can supply this instead).
3. Start the server from the project root:
   `undoom serve`   (equivalently `uvicorn undoomed.server:app --reload`)
   It listens at `http://127.0.0.1:8000` (visit `/docs` for an interactive page).
   The memory file `undoomed_state.db` is created in whatever folder you launch
   it from, so launch from the project root.

**B. Load the browser extension (Chrome or Edge):**

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **"Load unpacked"** and select the project folder (`undoomed/`).
4. The Un-doomed icon appears in the toolbar.

**C. Use it:**

1. Open any LeetCode problem (e.g. Two-Sum) and type some code.
2. Click the Un-doomed toolbar icon → **"Request Socratic Review."**
3. Read the hints. Revise. Ask again. When your logic is clean, you'll get the
   style review and an "Approved" badge.

---

## 8. Change Log (by prompt) — the project's story so far

This section grows with every prompt, so the project's evolution is always
readable top-to-bottom.

**Prompt 1 — Build the backend brain.**
Created `socratic_reviewer.py`: the shared `ReviewState` notebook, the strict
`ExecutionerSchema` for trustworthy verdicts, the three reviewer nodes
(Executioner, Socratic Tutor, Clean-Code Critic), the fork that routes between
them, and a built-in 2-turn demo proving memory persists across runs using the
same `thread_id`.

**Prompt 2 — Fairer counting + a real web server.**
(a) Moved the `loop_count` increase out of the Executioner and into the Socratic
Tutor, so a student who is correct on the first try is never charged an attempt.
(b) Added `server.py`, wrapping the brain in a FastAPI web API with a
`POST /api/review` endpoint and a `/health` check.

**Prompt 3 — Durable memory.**
Swapped the temporary in-memory saver for a durable **`SqliteSaver`** that writes
to `undoomed_state.db`. The database is initialized cleanly at startup and closed
neatly at shutdown, so a student's history now survives full server restarts.
(Confirmed the synchronous setup is the right fit for the current deployment;
no async needed.)

**Prompt 4 — This document + the Chrome extension (Phase 2).**
Created this `documentation.md`, and built the Manifest V3 Chrome extension that
targets LeetCode: `manifest.json` (permissions + host access), `content.js`
(scrapes the problem text and code, with a robust Monaco strategy),
`popup.html` / `popup.css` (a clean, distraction-free panel), and `popup.js`
(creates/stores a `thread_id`, scrapes the page, POSTs to the local API, and
displays the hints or style review).

**Prompt 5 — End-to-end smoke test + troubleshooting guide.**
Added `smoke_test.py` (standard-library only) that sends the *exact* payload the
extension sends, twice on one fresh `thread_id`, and verifies `loop_count` goes
1 → 2 both in the API response and as actually written to `undoomed_state.db`.
Documented how to load the unpacked extension and a DevTools checklist for
diagnosing CORS / connection failures (new section 9 below).

**Prompt 6 — Multiple AI providers + where the API key goes.**
Made the backend provider-agnostic. The single hard-coded OpenAI client became a
small factory (`get_llm()` in `socratic_reviewer.py`) that reads two environment
variables — `LLM_PROVIDER` (openai / anthropic / gemini / deepseek) and an
optional `LLM_MODEL` — and builds the matching LangChain client, importing each
provider's SDK lazily. Added a `.env.example` template showing exactly where to
put your API key. See the new section "Choosing an AI provider" below.

**Prompt 7 — Provider + API key chosen *in the extension* (Settings page).**
Moved provider/key selection out of the server's `.env` and into the extension so
each user configures their own. Added an extension **Settings page**
(`options.html` / `options.css` / `options.js`, opened via a ⚙ link in the
popup) where the user picks a provider, an optional model, and pastes their API
key — stored in `chrome.storage.local`. The popup now sends `provider`, `model`,
and `api_key` with each request. The backend (`build_llm(...)` +
`POST /api/review`) builds a client from those per-request credentials, falling
back to `.env` only when the extension sends none (so the smoke test still
works). The key is stored unencrypted in the browser and sent to the local
server — fine for a localhost tool you run yourself.

**Prompt 8 — "Test connection" button + the CLI client (Phase 3).**
(a) Added a **Test connection** button to the extension's Settings page — it
fires a trivial review at the local server with the current form values and
reports success or the exact error, so a "bring your own key" user can verify
their key before saving. (b) Built `cli.py`, a terminal client (`click` + `rich`)
so a developer can run `undoom check <file>`: it loads/saves credentials in
`~/.undoomed_config.json` (prompting securely on first run), keeps a per-project
`thread_id` in `.undoomed_session`, POSTs to `/api/review`, and prints the hints
or style review as `rich` panels with Markdown. Added an `undoom.bat` shortcut
and listed the CLI deps (`click rich requests`) in `requirements.txt`.

**Prompt 9 — Real Python package + the landing page (Phase 4).**
Turned the project into a proper installable package. Moved `cli.py`, `server.py`,
and `socratic_reviewer.py` into a standard **`src/undoomed/`** layout, added a
modern **`pyproject.toml`** (dependencies, optional `[anthropic]/[gemini]/
[deepseek]/[all]` extras, and a `[project.scripts]` entry point mapping `undoom`
→ `undoomed.cli:cli`). After `pip install -e .`, `undoom` is a real global
command with two subcommands: `undoom check <file>` and a new `undoom serve`
(launches the API). The server's DB now lives in the working directory (not
inside the package), and the old `undoom.bat` was removed (pip installs the
command now). Also built `index.html`, a responsive Tailwind landing page (hero
hook + download cards for the extension, CLI, and the two "coming soon" targets).

**Prompt 10 — Beta-access modal + Claude `agent.md` integration.**
(a) The landing page's extension card button became **"Get Beta Access,"** opening
a themed modal with 3-step "Load unpacked" instructions and a `.zip` download
(placeholder). (b) Created **`agent.md`** — a drop-in spec that makes AI
assistants (Claude Code, Cursor) act the Un-doomed way: never write the fix,
instead run `undoom check <file>` and guide the developer with Socratic
questions. (c) The landing page's `agent.md` card changed from "Coming soon" to
**"View instructions,"** opening a modal that shows the `agent.md` contents with
Copy + Download. Both modals share one open/close script (backdrop / ✕ / Escape).

**Prompt 11 — Escaping the "Localhost Trap" (deploy prep).**
Made the clients point anywhere, not just localhost. Added a shared **`config.js`**
(one `UNDOOMED_API_BASE_URL` line, loaded by both popup and options pages); the
CLI reads the same value from an **`UNDOOMED_API_URL`** env var (default
localhost). Added Render/Railway wildcards to the extension's `host_permissions`.
Added **`vercel.json`** + **`.vercelignore`** so Vercel serves only the static
frontend and ignores the Python backend, and a production **`Dockerfile`** (+
`.dockerignore`) that installs the package with all providers and runs uvicorn on
`$PORT` for Render/Railway. The earlier `UNDOOMED_DB` override now lets the cloud
DB live on a mounted disk.

**Prompt 12 — Shared-secret gate (production-ready).**
Added optional auth so a public backend doesn't burn your compute. The server
reads **`UNDOOMED_SERVER_SECRET`**: if set, every `/api/review` request must send
a matching **`X-Server-Secret`** header (else **401**, compared in constant time);
if unset, the API stays open for frictionless local dev. `/health` is always
open (for platform health checks). The extension Settings page gained an optional
**"Server password"** field (saved to `chrome.storage.local`, sent as the header
by both the popup and the Test-connection button), and the CLI now prompts for an
optional `server_secret` during setup (stored in `~/.undoomed_config.json`) and
sends it on every request. Verified with FastAPI's TestClient: no/!wrong header →
401, correct → 200, `/health` → 200.

**Prompt 13 — Open-source storefront (README + LICENSE).**
Added a polished **`README.md`** (badges, the Un-doomed philosophy, a Mermaid
architecture diagram, CLI quick-start, and Render/Railway deploy steps) and an
**MIT `LICENSE`**. Switched the package's long-description (`readme` in
`pyproject.toml`) from `documentation.md` to `README.md` (the conventional choice)
and updated the Dockerfile copy to match. Ready to push to GitHub.

**Prompt 14 — GitHub niceties: CI + templates + offline test provider.**
Added `.github/workflows/ci.yml` (on push/PR to `main`: sets up Python, installs
the package, byte-compiles, spins up the server, and runs `smoke_test.py`). To
make CI free and deterministic with **no API key**, added a built-in **`fake`
provider** (`LLM_PROVIDER=fake`) — an offline stub that always reports one fault,
so the Executioner → Tutor path and `loop_count` run predictably. `smoke_test.py`
now honours `UNDOOMED_API_URL` so it can target any port. Added issue templates
(`bug_report.md`, `feature_request.md`) and `PULL_REQUEST_TEMPLATE.md`. Verified
locally by running the exact CI flow against the fake provider → `RESULT: PASS`.

---

## 9. Testing & troubleshooting

### 9.1 The automated smoke test (`smoke_test.py`)

This is the fastest way to be *certain* the plumbing works before touching the
browser at all. It imitates the extension by sending the same JSON shape
(`task_description`, `current_code`, `thread_id`) to the running server.

How to run it:

1. Make sure the backend is running in one terminal: `uvicorn server:app`
2. In a second terminal: `python smoke_test.py`

What it proves, step by step:

- The server is alive (it pings `/health` first).
- It invents a brand-new `thread_id` (so the test always starts clean).
- **Turn 1:** sends clearly-broken code → expects the tutor to answer and
  `loop_count` to be **1**.
- **Turn 2:** sends a different-but-still-broken version with the **same**
  `thread_id` → expects `loop_count` to be **2**.
- It then opens `undoomed_state.db` directly and confirms the value `2` was
  truly saved to disk — not just held in memory.

If every line prints `[PASS]` and it ends with `RESULT: PASS`, the extension
payload, the FastAPI server, and the SQLite memory are all communicating
correctly.

### 9.2 Loading the unpacked extension into Chrome

1. Open Chrome and type `chrome://extensions/` in the address bar.
2. Turn **Developer mode** ON (toggle, top-right).
3. Click **"Load unpacked."**
4. Choose the project folder — the one that contains `manifest.json`
   (e.g. `…/Downloads/undoomed`). Select the folder itself, not a file inside it.
5. An "Un-doomed — Socratic Reviewer" card appears. Note its **ID** and, if you
   like, click the puzzle-piece icon in the toolbar to **pin** it.
6. Open a LeetCode problem (e.g. Two-Sum) and **reload that tab** so `content.js`
   is freshly injected. Click the Un-doomed icon → **"Request Socratic Review."**
7. Whenever you edit any extension file, return to `chrome://extensions/` and
   click the **circular reload arrow** on the card to apply your changes.

### 9.3 Where the consoles are (and which one matters)

Our extension has **no background service worker** (none is declared in
`manifest.json`), so there is nothing to inspect there yet. The network request
to the API happens in the **popup**, so that's the console to watch.

- **Popup console (most important):** open the popup, then **right-click inside
  it → "Inspect."** A DevTools window opens that stays open and shows the popup's
  Console and Network tabs. The `fetch` to `/api/review` lives here.
- **Page (content-script) console:** open normal DevTools on the LeetCode tab
  (F12). `content.js` logs and any scraping errors show up here.
- **Service-worker console (not used yet):** on `chrome://extensions/`, a card
  with a background worker would show an "Inspect views: service worker" link.
  Ours doesn't have one — if we add one later, that's where its logs appear.

### 9.4 CORS / connection failure checklist

When "Request Socratic Review" fails, open the **popup console** (§9.3) and look
for one of these:

| What you see in the console | What it almost always means | Fix |
|---|---|---|
| `net::ERR_CONNECTION_REFUSED` or `TypeError: Failed to fetch` | The server isn't running, or it's on a different port. | Start it: `uvicorn server:app`. Confirm it's on `127.0.0.1:8000`. |
| Request goes to `http://localhost:8000/...` and is blocked | `manifest.json` only grants `127.0.0.1`, and `localhost` is treated as a *different* origin. | Use `127.0.0.1` everywhere (the code already does), or add `http://localhost:8000/*` to `host_permissions`. |
| `Access to fetch … has been blocked by CORS policy` | The request is being treated as a cross-origin web request without permission. From the **popup** with `127.0.0.1` in `host_permissions`, this should *not* happen — if it does, you likely edited `manifest.json` without reloading the extension, or moved the `fetch` into a content script. | Reload the extension on `chrome://extensions/`. If you intend to call the API from a content script or web page, add CORS support on the server (see §9.5). |
| HTTP `500` in the Network tab | The server received the request but errored while handling it. | Read the **uvicorn terminal** — most often a missing/invalid `OPENAI_API_KEY`. |
| `403` / "host permission" warning | The extension wasn't granted access to the API host. | Ensure `http://127.0.0.1:8000/*` is in `host_permissions`, then reload the extension. |

### 9.5 If you ever do need server-side CORS

The current design (the `fetch` runs in the popup, an extension page, and
`127.0.0.1:8000` is in `host_permissions`) means the browser lets the request
through **without** any CORS configuration on the server. You only need the
following if you later call the API from a content script or a regular web page.
Add this near the top of `server.py`, just after the app is created:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # or your extension's chrome-extension://<id>
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 9.6 Continuous integration (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and pull request to `main`. It
installs the package, byte-compiles everything, starts the backend, and runs
`smoke_test.py` against it — the same end-to-end check you can run locally.

The trick that makes CI **free and reliable**: it sets `LLM_PROVIDER=fake`, a
built-in **offline test provider** that needs no API key and no network. The fake
always reports one fault, so the Executioner → Socratic Tutor path runs and
`loop_count` increments deterministically (1 → 2), exactly what the smoke test
expects. (You can use it locally too: `LLM_PROVIDER=fake undoom serve`.)

A green run is what backs the "build passing" badge in the README.

---

## 10. Choosing an AI provider (and where the API key goes)

There are **two** ways to choose the provider and supply a key. The recommended
way — and the one a normal user of the extension uses — is the **extension's
Settings page**. The `.env` way still exists as a fallback (handy for the smoke
test or running the backend without the extension).

### 10.1 The easy way — the extension's Settings page

1. Click the Un-doomed toolbar icon to open the popup, then click **⚙ Settings**
   (bottom-left). This opens the full Settings page in a new tab.
2. Pick your **AI provider** from the dropdown.
3. Optionally type a **model** to override the default.
4. Paste your **API key** into the field and click **Save settings**.
5. Click **Test connection** to confirm it works — this sends a tiny request to
   your local server with the current values and reports success or the exact
   error (bad key, server down, missing package) without leaving the page.

From then on, every review you request sends your chosen provider, model, and
key to your local server along with the code. Nothing needs to be set on the
server. (You still need the provider's Python package installed once on the
server — see the table below.)

**Where is the key stored?** In your browser only (`chrome.storage.local`), and
it is sent to your local server at `127.0.0.1:8000`. It is *not* encrypted at
rest, so don't enter it on a shared computer, and keep the server on your own
machine.

### 10.2 The fallback way — the server's `.env` file

If the extension sends no key (e.g. you're running `smoke_test.py`, or testing
the API directly), the server falls back to a **`.env`** file next to
`server.py`. Copy `.env.example` to `.env` and set:

```
LLM_PROVIDER=openai     # openai | anthropic | gemini | deepseek
# LLM_MODEL=            # optional: override the default model
OPENAI_API_KEY=sk-...   # the key for whichever provider you chose
```

### 10.3 Providers, keys, and packages

| Provider     | Key (extension field or `.env`) | Default model        | Install once on the server            |
| ------------ | ------------------------------- | -------------------- | ------------------------------------- |
| `openai`     | `OPENAI_API_KEY`                | `gpt-4o-mini`        | (already installed)                   |
| `anthropic`  | `ANTHROPIC_API_KEY`             | `claude-opus-4-8`    | `pip install langchain-anthropic`     |
| `gemini`     | `GOOGLE_API_KEY`                | `gemini-2.5-flash`   | `pip install langchain-google-genai`  |
| `deepseek`   | `DEEPSEEK_API_KEY`              | `deepseek-chat`      | `pip install langchain-deepseek`      |

You only need the `pip install` for the provider you actually use. If it's
missing, the server replies with a clear message telling you which package to
install.

### 10.4 How it works under the hood (for the curious)

The popup reads your saved settings and includes `provider`, `model`, and
`api_key` in the POST to `/api/review`. The server hands those to a factory
called `build_llm(...)`, which builds the right LangChain client **for that one
request** and passes it into the review flowchart (via LangGraph's per-call
config). So all three reviewers share the same simple "ask the model" interface
and don't care which company's AI — or whose key — is behind them. The provider's
software is imported only when selected, which is why you don't have to install
all four. One subtlety: the newest Claude models reject the "temperature"
setting, so the Claude client is created without it.

---

## 11. The CLI client (Phase 3)

The CLI lets a developer get the same Socratic review from the terminal, without
a browser. It's the file `cli.py`, run as `undoom check <file>`.

### 11.1 First-time setup

Install the package once — this gives you the global `undoom` command plus all
its dependencies:

```
pip install -e .
```

On the very first `undoom check`, it notices you have no saved settings and asks
you, right in the terminal, for your **provider**, an optional **model**, and
your **API key** (the key is typed hidden, like a password). It saves those to a
hidden file in your home folder, `~/.undoomed_config.json`, so it never asks
again. To change them later, run any check with `--reset-config`.

### 11.2 Running a review

```
undoom check Solution.java
undoom check script.py --task "Implement binary search over a sorted list"
```

- The **file path** is required; the CLI reads that file's contents.
- `--task` (optional) describes what the code should do. If you omit it, it
  defaults to *"Review this code for logic and edge cases."*
- After `pip install -e .`, `undoom` is a real command on your PATH — run it from
  any directory. (Without installing, run `python -m undoomed.cli check <file>`
  from the project root.)

### 11.3 The per-project memory (`.undoomed_session`)

The first time you run a check **inside a project folder**, the CLI creates a
small file there called `.undoomed_session` holding a `thread_id`. Every later
check in that same folder reuses it, so the backend recognises it as the same
ongoing session and the attempt counter (`loop_count`) climbs — exactly like the
extension's per-student memory, but per project directory. Check from a different
folder and you get a fresh session.

### 11.4 What you see

The result prints as a tidy `rich` panel with Markdown:

- **Needs revision** → a yellow "Edge-case faults found" panel (the bug list)
  followed by a magenta "Socratic Hints" panel.
- **Approved** → a green "Style Review" panel.

If the server isn't running, or your key is wrong, the CLI prints a clear red
error panel and exits with a non-zero status (handy for scripts).

### 11.5 How it maps to the backend

The CLI sends the **exact same** JSON the extension does — `task_description`,
`current_code`, `thread_id`, plus `provider` / `model` / `api_key` — to
`POST /api/review`. So the backend treats CLI and extension requests identically;
they only differ in where the code and credentials come from.

---

## 12. Packaging — the `undoom` command (Phase 4a)

The project is a standard installable Python package, so `undoom` becomes a real
command on your machine.

### 12.1 The layout

- **`pyproject.toml`** is the single source of truth: project name, version,
  dependencies, optional provider extras, and the command entry point.
- The importable code lives under **`src/undoomed/`** (the modern "src layout").
  `undoomed.cli`, `undoomed.server`, and `undoomed.socratic_reviewer` are the
  three modules.
- `[project.scripts]` maps the command `undoom` to the function `cli` in
  `undoomed.cli`. That's what makes `undoom` appear on your PATH.

### 12.2 Installing

```
pip install -e .            # editable install: the command + all dependencies
pip install -e ".[anthropic]"   # ...plus the Claude provider library
pip install -e ".[all]"     # ...plus all extra providers
```

"Editable" means the installed command points back at your source files, so
edits take effect immediately — no reinstall needed.

### 12.3 The two subcommands

- `undoom serve` — starts the backend API (a friendly wrapper around uvicorn).
  Run it from your project root so the `undoomed_state.db` memory file lands
  there. Add `--reload` while developing.
- `undoom check <file>` — the Socratic review described in section 11.

---

## 13. The landing page (`index.html`, Phase 4b)

`index.html` is a self-contained marketing page you can open directly in a
browser (Tailwind CSS is loaded from a CDN, so there's no build step). It follows
the same calm, "anti-doomscrolling" brand: a near-white surface with a faint
grid, dark-indigo accents, generous whitespace, and gentle motion.

It has:

- a **hero** with the hook *"Stop scrolling. Start building."* and a little
  terminal mock-up showing an `undoom check` result;
- a **"how it works"** row introducing the three reviewers;
- a **downloads** section with four cards:
  - **Browser Extension** — a **"Get Beta Access"** button that opens a styled
    modal with 3-step "Load unpacked" instructions and a `.zip` download button
    (placeholder `undoomed-extension.zip`);
  - **CLI Tool** — a copy-to-clipboard `pip install undoomed`;
  - **Claude `agent.md`** — a **"View instructions"** button that opens a modal
    showing the `agent.md` contents, with Copy + Download buttons;
  - **VS Code Extension** — still marked **Coming soon**;
- a short **FAQ** and footer.

Both modals share one small open/close script (backdrop click, ✕ button, and the
Escape key all close them).

To view it: just double-click `index.html` (or open it in any browser).

---

## 14. Claude Code / Cursor integration (`agent.md`)

`agent.md` is a drop-in instruction file. Place it in a project's root and an AI
coding assistant that reads project rules (Claude Code CLI, Cursor, etc.) will
adopt the Un-doomed philosophy:

- When asked to **review / debug / fix** code, it must **not** write the fix.
- Instead it runs **`undoom check <filename>`** in the terminal, reads the
  reported edge-case faults and Socratic hints, and relays them to the developer
  as **questions** — guiding them to fix it themselves.
- Only once Un-doomed reports the logic is `approved` may it discuss style.

It's the same Socratic philosophy as the three reviewers, but applied to *any* AI
assistant the developer already uses — turning that assistant into an Un-doomed
mentor instead of an answer dispenser.

---

## 15. Going live — deployment (Phase 5)

To share Un-doomed with friends, two things get deployed separately: the static
**landing page** (Vercel) and the **backend** (a container host like Render or
Railway). The clients (extension + CLI) then point at the deployed backend.

### 15.1 Point the clients at your backend

Everything funnels through one setting:

- **Extension:** edit the single line in **`config.js`**
  (`window.UNDOOMED_API_BASE_URL = "https://your-backend..."`). Both the popup
  and the Settings page read it.
- **CLI:** set an environment variable —
  `export UNDOOMED_API_URL=https://your-backend...` (or edit the default in
  `cli.py`).
- **Extension permissions:** the backend's origin must also be in
  `host_permissions` in `manifest.json`, or the browser blocks the call. The
  Render (`*.onrender.com`) and Railway (`*.up.railway.app`) wildcards are
  already there; add your own custom domain if you use one. Reload the extension
  after editing.

### 15.2 Deploy the landing page to Vercel

`vercel.json` tells Vercel this is a **static** project (no build, no install)
and to serve the repo root; `.vercelignore` removes the Python backend from the
upload so the build can't fail on it. Connect the GitHub repo to Vercel and it
will serve `index.html` (plus `agent.md`, the CSS/JS, etc.). No environment
variables are needed for the page itself.

### 15.3 Deploy the backend with Docker (Render / Railway)

The `Dockerfile` builds a production image:

- installs the package with **all** AI providers, so any client-chosen provider
  works;
- runs as a non-root user;
- binds uvicorn to `0.0.0.0` on the platform's **`$PORT`**.

On Render or Railway: create a new service from the repo, choose **Docker**, and
deploy — no start command needed (the image's `CMD` handles it). You do **not**
have to set provider API keys on the server: each client sends its own key per
request. (If you want a server-side fallback key, set `OPENAI_API_KEY` etc. as
environment variables.)

**One caveat — memory persistence:** the SQLite memory file lives in the
container's working directory, which most platforms **wipe on every redeploy**.
For durable `loop_count`/history, attach a persistent disk and set
`UNDOOMED_DB=/data/undoomed_state.db` (with the disk mounted at `/data`).

### 15.4 Lock down the backend with a shared secret

A public backend with no auth means anyone who finds the URL can spend your
server's compute (they'd still need their own AI key, so *your* key isn't at
risk — but your bandwidth/CPU is). Fix it with one environment variable:

1. On your host (Render/Railway), set **`UNDOOMED_SERVER_SECRET`** to a long
   random string. That instantly requires every `/api/review` call to carry a
   matching `X-Server-Secret` header; anything else gets a `401`.
2. Give your friends that password. They paste it once:
   - **Extension:** Settings → **Server password** → Save.
   - **CLI:** it's asked during first-time setup (or run a check with
     `--reset-config` to set it). Stored in `~/.undoomed_config.json`.

Leave `UNDOOMED_SERVER_SECRET` unset for local development and the gate is simply
off — no header needed. (`/health` is never gated, so platform health checks keep
working.)

---

## 16. What's next (ideas, not yet built)

- Optional icons for the extension toolbar.
- Triggering a review from a button *inside* the overlay (today the toolbar
  popup is what starts a review; the overlay shows + remembers the results).
- Proper LaTeX/maths rendering in the overlay (today `$O(log n)$` is shown in a
  clean monospace style rather than typeset).
- Support for more coding sites beyond LeetCode.
- Publishing `undoomed` to PyPI so `pip install undoomed` works for everyone
  (today it's an editable local install).
- A real VS Code extension (the last "coming soon" client).
- Producing the actual `undoomed-extension.zip` artifact for the download button.

---

## Change Log

### Prompt 15 — Point extension & CLI at the live Render backend (2026-06-07)

**What changed:**

- **`config.js`** — swapped the single-line URL from `http://127.0.0.1:8000` to
  `https://undoomed.onrender.com`. This is the only change needed to make the
  extension talk to the live server; `popup.js` and `options.js` both read this
  file automatically.

**Why this is all you need to do for the extension:**
`config.js` was designed as the "single swap point". `manifest.json` already
lists `*.onrender.com` in `host_permissions`, so the browser won't block the
request — no manifest change needed.

- **`src/undoomed/cli.py`** — changed the default `API_BASE_URL` from
  `http://127.0.0.1:8000` to `https://undoomed.onrender.com`. Now anyone who
  runs `undoom check <file>` after installing the package automatically hits the
  live server — no env var or config step required. The `UNDOOMED_API_URL` env
  var override stays for developers running a local server. The connection-error
  message and module docstring were also updated to reflect the new default.

**Next steps (one-time, if not done already):**
1. Reload the unpacked extension in Edge/Chrome (Extensions → reload icon) so
   the new `config.js` takes effect.
2. If you set `UNDOOMED_SERVER_SECRET` on Render, paste the same value into
   the extension's Settings → **Server password** field.
3. Local dev: to point the CLI at your local server, run:
   `export UNDOOMED_API_URL=http://127.0.0.1:8000`

### Prompt 16 — Language-aware review + on-page overlay + per-problem history (2026-06-07)

Three problems surfaced from real use (a Java submission was reviewed as if it
were Python; the result was cramped and hard to read; and closing the popup lost
the answer, forcing a costly re-submit). All three are now fixed.

**1. Language-aware review (the big bug).**
The style reviewer used to be hard-wired to "PEP 8 / idiomatic Python", so it
ignored the language you actually picked and even rewrote your Java as Python.
Now:
- The extension reads the **real language** from the editor (Monaco's own
  language id, e.g. `java`, `cpp`, `python`) and sends it with every request.
- The backend carries a new `language` field through the whole review and tells
  **all three reviewers** which language they're looking at. The Clean-Code
  Critic now reviews against the *correct* style guide per language (PEP 8 for
  Python, the Google Java Style Guide for Java, the C++ Core Guidelines for C++,
  and so on), and is explicitly told never to assume or rewrite the code in
  another language. Unknown languages get a sensible generic style review.

**2. A readable, roomy on-page overlay.**
The old popup printed the model's raw Markdown, so you saw literal `###`, `**`,
and `$O(log n)$`. Two changes fix readability:
- **`md.js`** — a tiny, dependency-free, *safe* Markdown→HTML renderer (it
  escapes all HTML first, then adds only a fixed set of tags, so model output
  can't inject anything). Shared by both the popup and the overlay.
- **`content.js`** now draws an **on-page overlay** (a right-side drawer in an
  isolated Shadow DOM, so LeetCode's styles can't interfere). It's wide,
  scrollable, and renders the review as clean headings/lists/code. There's a
  small floating **"⏻ Un-doomed"** launcher to open/close it. You can switch
  this off in Settings (**"Show results as an on-page overlay"**) to fall back to
  the in-popup card, which now also renders Markdown.

**3. Per-problem history (no more re-submitting to see your last answer).**
- Every review is saved in the browser (`chrome.storage.local`) under a key
  unique to that problem. The overlay has a **History** tab listing past reviews
  for the current problem; clicking one re-opens it instantly — **no API call,
  no tokens spent**. Reloading the page keeps the history, and the launcher shows
  a small badge with how many saved reviews exist.
- The backend memory is now **per problem** too: the `thread_id` is
  `<your-id>__<problem-slug>`, so `loop_count` and the "escalate to a direct
  answer after 3 tries" logic track each problem separately (previously one
  global counter was shared across every problem).

**Files touched:** `socratic_reviewer.py`, `server.py` (backend `language`);
`md.js` (new), `content.js`, `popup.js`, `popup.html`, `popup.css`,
`options.html`, `options.js`, `options.css`, `manifest.json` (extension).

**Verified:** Python byte-compiles; the offline (`fake`) 2-turn demo and the
full FastAPI smoke test both pass (`loop_count` 1→2, persisted to SQLite); all
JS files pass a Node syntax check.

**To get the fixes:** reload the unpacked extension (Extensions → reload), and
redeploy the backend on Render so the language-aware reviewer is live.
