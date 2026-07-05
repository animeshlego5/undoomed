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
├─ icons/                 # Toolbar/store icons (16/48/128px blue "?" mark)
├─ background.js          # Service worker: the shared review engine (read code,
│                         #   fetch backend, save history, drive the overlay)
├─ content.js             # On-page controls + the results OVERLAY (Shadow DOM)
├─ md.js                  # Safe Markdown→HTML renderer (shared by overlay)
├─ config.js              # SHARED client config: the backend URL (one place to edit)
├─ popup.html / .css / .js     # Toolbar popup: a thin trigger for a review
├─ options.html / .css / .js   # Settings page (provider + key + panel side + Test)
│
├─ agent.md               # Drop-in AI-assistant rules (Claude Code / Cursor)
├─ vscode-extension/      # VS Code client: review the file you're editing
├─ website/               # The marketing site (Vite + React + Tailwind v4, Bun)
│  ├─ src/components/     #   Nav, Hero, Downloads, modals… one file each
│  ├─ scripts/            #   build step that zips the extension for download
│  └─ public/             #   static files (agent.md, favicon, the zip)
│
├─ vercel.json            # Vercel: build website/ with Bun, serve website/dist
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
*wrong answer* — the smallest allowed inputs, duplicates, "no solution exists,"
using the same item twice, returning nothing, and so on. It is forced to answer
in a strict yes/no-plus-list format (`has_errors`, `issues`) so the rest of the
flowchart can trust its verdict. It does **not** care about style.

A critical rule added in Prompt 19: **the Executioner must respect the problem's
stated Constraints.** If the problem says "1 ≤ arr.length ≤ 10^4", it will never
raise "does not handle an empty array." Only faults within the valid input space
the problem defines count as real bugs.

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
adds a toolbar button AND on-page controls right on the LeetCode page. The
extension follows **Manifest V3**, the current standard Google requires.

Since Prompt 17 the work is split across three kinds of script, which is the
normal MV3 shape: a **service worker** (`background.js`) does the privileged work
(reading the editor, calling the backend); a **content script** (`content.js`)
draws the on-page buttons and results panel; and the **toolbar popup**
(`popup.js`) is just a convenient second button.

### 6.2 `manifest.json` — the ID card and permission slip

This file tells Chrome:

- The extension's **name**, **version**, and **description**.
- Its **permissions** — `storage` (save settings + history), `activeTab`, and
  `scripting` (run a small reader function inside the page to grab the code from
  Monaco).
- Its **host permissions** — the sites it may talk to: `leetcode.com` (read the
  problems), your local backend, and the deployed backends (`*.onrender.com`,
  `*.up.railway.app`).
- Its **action** — clicking the toolbar icon opens `popup.html`.
- Its **icons** — the `icons/` folder holds the brand mark (a **phone whose
  body forms a "D", struck through in blue** — doomscrolling, crossed out — on
  a cream rounded square) at 16, 48, and 128 pixels, used in the toolbar, the
  extensions page, and any future store listing. The same mark appears inside
  the popup, the Settings page, and the on-page panel as an inline drawing
  that recolors itself for light/dark mode.
- Its **background service worker** — `background.js` (the review engine, §6.3).
- Its **content scripts** — `md.js` then `content.js`, auto-loaded on any
  `https://leetcode.com/problems/*` page.

### 6.3 `background.js` — the service worker (the review engine)

This is the brain of the extension client, added in Prompt 17. Whenever any
button asks for a review (`UNDOOMED_RUN_REVIEW`), the worker does the whole job
in one place:

1. **Builds a per-problem `thread_id`** — a unique per-browser id plus the
   problem slug (`<your-id>__<slug>`), so the backend keeps a separate attempt
   count / memory per problem.
2. **Reads the full code *and* the selected language** by running a tiny reader
   in the page's **main world** (where `window.monaco` is reachable). The
   language is Monaco's own id, e.g. `java` / `python` / `cpp`.
3. **Asks `content.js`** for the problem description (and a DOM code fallback).
4. **Reads your settings** (provider, model, key, server password) from storage.
5. **POSTs** `{ task_description, current_code, language, thread_id, … }` to the
   backend.
6. **Saves the result to history** and **pushes it to the on-page panel**
   (loading → result, or an error message).

**Why a service worker?** A content script in Manifest V3 can't make a
cross-origin request with the extension's privileges (it's limited by the page's
CORS) and can't reach `window.monaco` on its own. The service worker can do
both. Putting the logic here means the toolbar popup and the on-page buttons
share exactly one code path. (The Monaco-recycling problem from earlier still
applies — Monaco only keeps on-screen lines in the DOM — which is why the worker
reads Monaco's in-memory model directly, with `content.js`'s DOM scrape as a
fallback.)

### 6.4 `content.js` — the on-page controls, panel, and history

This runs *inside* the LeetCode page (in the isolated world) and owns everything
you see on the page:

- **The launcher** — a small floating pill at the bottom-right with two buttons:
  **Review** (start a review without opening the toolbar popup) and a toggle that
  opens/closes the panel. A little badge shows how many saved reviews this
  problem has.
- **The panel** — a drawer rendered in a **Shadow DOM** (an isolated
  mini-document, so LeetCode's CSS can't distort it and ours can't leak out). It
  starts **below LeetCode's top bar** so it never covers the timer/avatar, and it
  can sit on the **left or right** (your choice — see §6.6). Its header has a
  **⚙ settings** button, a **⇄ flip** button and a **×** close button. Inside: a
  big "Request Socratic Review" button, a **Current** tab (the latest review) and
  a **History** tab. At the bottom, a **footer** shows the active provider · model
  and doubles as a second link to Settings.
- **Theme** — the whole panel is **greyscale with one blue accent**: greys carry
  the layout, and blue is reserved for the things that matter (the Review
  button, the active tab, links, and the "Approved" badge). The panel also
  **matches LeetCode's appearance automatically**: turn on LeetCode's dark mode
  and the panel goes dark with it, instantly, no reload needed.
- **Description scraping** — it still answers `UNDOOMED_SCRAPE` with the problem
  text and a DOM code fallback.

### 6.5 `popup.html` / `popup.js` — the toolbar trigger

The popup is now deliberately thin. It shows the brand, one **"Request Socratic
Review"** button, a status line, and a footer with a settings link (which shows
the active **provider · model**, so you always know what will answer before you
click) plus the current problem's name. When clicked it checks you're on a
LeetCode problem with an API key set, then asks the service worker to run the
review — the results appear in the on-page panel. (You can ignore the popup
entirely and use the on-page **Review** button instead.)

The popup and the Settings page share the same **greyscale + blue** look and
both follow your computer's **light/dark mode** automatically.

### 6.6 Choosing the side + per-problem history

- **Left or right.** Set a default in **Settings → "On-page panel position"**, or
  flip it instantly with the **⇄** button on the panel. The choice is saved and
  applies on every problem (and updates live if you change it in Settings).
- **Resize it.** Drag the panel's inner edge (width), bottom edge (height), or
  bottom corner (both) to make it as wide as you need to read code comfortably.
  The size is remembered per browser. The **⇲** button (or double-clicking any
  edge) resets it to the default size.
- **History / no wasted tokens.** Every review is cached in
  `chrome.storage.local` under a key unique to that problem. The **History** tab
  lists past reviews; clicking one re-opens it **instantly with no API call**.
  This survives closing the popup *and* reloading the page, so you never have to
  re-run a review — and re-spend tokens — just to re-read an answer.
- **No-change guard.** If you hit **Review** without changing your code since the
  last review, Un-doomed skips the API call entirely and just re-shows your
  previous result with a small "no changes in your code" note — so you don't
  spend tokens getting the same answer.
- **`md.js`.** A tiny, dependency-free, **safe** Markdown→HTML renderer used by
  the panel. It escapes all HTML first and then adds only a fixed, known set of
  tags, so model output cannot inject scripts or arbitrary markup. This is what
  turns the raw `###`/`**`/`` `code` `` into clean headings, lists, and code.

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

1. Open Settings in either of two ways: click the toolbar popup's **⚙ Settings**
   link, or click the **⚙** button (or the provider · model **footer**) on the
   on-page panel. Either opens the full Settings page in a new tab.

   At the very top of the form a small **server health chip** tells you at a
   glance whether your Un-doomed backend is running: a **blue dot** means
   "connected", a **red dot** means "unreachable" (with a reminder to run
   `undoom serve`). It checks automatically when the page opens and after every
   Test connection; click the chip any time to re-check.
2. Pick your **AI provider** from the dropdown.
3. Choose a **model**. The model field is a dropdown that remembers every model
   that has passed a **Test connection** for the selected provider, so you can
   just pick a known-good one. Leave it on **"Default"** to use the provider's
   default, or choose **"+ Add a new model…"** to type a new model id.
4. Paste your **API key** into the field and click **Save settings**.
5. Click **Test connection** to confirm it works — this sends a tiny request to
   your local server with the current values and reports success or the exact
   error (bad key, server down, missing package) without leaving the page. **On
   success the model is remembered** and added to the dropdown for that provider.

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

## 13. The landing page (`website/`, Phase 4b — rebuilt in Prompt 23, redesigned in Prompt 25)

The marketing site lives in the **`website/`** folder as a modern web app:
**Vite** (the build tool), **React 19** (components), **Tailwind CSS v4**
(styling), and **Bun** (the fast JavaScript runtime/package manager that
installs and builds it). It replaced the old single-file `index.html`, which
has been deleted. No backend is required — the site is fully static.

**The look (Prompt 25, inspired by auxia.io):** a warm **cream canvas
(`#f0efe3`)** with near-black ink, hairline borders, big editorial type, and
the single blue accent reserved for what matters. The body face is
**PP Neue Montreal** (falling back to Arial — see the licensing note in
`src/index.css`: it's a commercial font, so drop your licensed `.woff2` files
into `public/fonts/` and uncomment the `@font-face` block to activate it).
The terminal stack (`Monaco, Menlo, …`) is kept for code, chips, and the small
uppercase "eyebrow" labels. There are **no emojis** — every pictogram is a thin
**lucide icon** — and the site is deliberately light-only so the cream brand
color always shows.

The layout (each piece is its own file in `website/src/components/`):

- `Nav` — sticky frosted header; `Hero` — *"Stop scrolling. Start building."*
  above the centerpiece:
- `BrowserDemo` — a **self-playing product demo**: a browser window with the
  real Safari toolbar layout (traffic lights, sidebar + back/forward buttons,
  privacy shield, centered address pill with a reload icon, then share /
  new-tab / tabs buttons) showing a mock LeetCode "Two Sum" page — problem
  text left, dark **line-numbered** code editor right (with a LeetCode-style
  header: a "Code" label and a **Python3 language selector**) showing a subtly
  buggy solution. It plays in four steps: the launcher pill is "clicked", the review
  panel slides in, a spinner runs, then the verdict + two **edge-case faults**
  and finally two **Socratic hints** appear line by line — exactly the
  first-agent experience, hints and never the answer. Below the window a
  **clickable step indicator** (four chips on a blue rail: Review requested ·
  Analyzing code · Edge-case faults · Socratic hints) shows where the story
  is; clicking a chip jumps the demo to that step. For people who prefer
  reduced motion it opens on the finished state and doesn't auto-play (the
  chips still work), and the window itself is marked decorative for screen
  readers with a text alternative.
- `HowItWorks` — an auxia-style **scroll journey**: a connector line that
  **snakes** down the page — beside stage 1 on the left, a rounded turn
  across the page (carrying a small caption like "FAULTS BECOME QUESTIONS"),
  down beside stage 2 on the right, and back to the left for stage 3 —
  **drawing itself in blue as you scroll** (the path is measured from the
  real layout and revealed with an SVG dash-offset; phones get a straight
  left rail). Each stage has a **black pill** (agent icon + name), its
  description, and a **live looping demo card** showing that agent at work:
  the Executioner sweeps edge cases and lands a "3 FAULTS FOUND" verdict,
  the Tutor "types" and asks two Socratic questions, and the Critic strikes
  through O(n²), replaces it with O(n), and ticks a style checklist. Stages
  fade up the first time they enter the viewport; all motion respects the
  reduced-motion setting;
- `Downloads` — four cards: **Browser Extension** ("Get Beta Access" modal with
  load-unpacked steps and a real `.zip` download — see below), **CLI Tool**
  (copy-to-clipboard `pip install undoomed`), **VS Code** (a setup modal for
  the new extension in `vscode-extension/` — see below), and
  **Claude `agent.md`** (modal with the file's contents + Copy/Download);
- `Faq` — a full-width editorial split (heading left, accordion right):
  numbered questions that highlight and nudge right on hover, a plus that
  rotates into an ✕, and answers that slide open smoothly; `Cta` (a dark ink
  panel),
  `Footer`; `Modal` — one shared, accessible modal (Escape, backdrop click,
  and the X icon all close it; the page behind stops scrolling).
- `LogoMark` — the phone-crossed-out **icon**; `Wordmark` — the **"Un-Doomed"
  text**, where a single continuous blue stroke acts as both the hyphen after
  "Un" and the line struck through "Doomed" (so the two always line up — see
  Prompt 41). Both are shared by `Nav` and `Footer` so the logo never drifts.

**The download is real now:** at build time a small script
(`website/scripts/make-extension-zip.mjs`) zips the actual extension files
(manifest, scripts, styles, icons) into `public/undoomed-extension.zip`, so the
site always ships the current extension version.

To work on it: `cd website`, then `bun install` once, `bun run dev` for a live
dev server, `bun run build` to produce the deployable `dist/` folder.

> **"bun is not recognized"?** Terminals only read the PATH when they start, so
> any terminal that was already open when Bun was installed can't see it.
> Either open a **new** terminal, or refresh the current one with
> `$env:Path += ";$env:USERPROFILE\.bun\bin"` (PowerShell) and try again.

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

`vercel.json` tells Vercel to build the site with **Bun**: it runs
`cd website && bun install` and `cd website && bun run build`, then serves the
resulting `website/dist` folder. `.vercelignore` keeps the Python backend out
of the upload (anchored as `/src/` so it doesn't accidentally exclude
`website/src/`) — the extension files stay in, because the build zips them into
the downloadable `undoomed-extension.zip`. Connect the GitHub repo to Vercel
and it does the rest; no environment variables are needed for the page itself.

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

- A true button injected into LeetCode's own editor toolbar (today the on-page
  **Review** button is a floating launcher we fully control — robust against
  LeetCode's frequent DOM/class renames — rather than injected into their bar).
- Proper LaTeX/maths rendering in the overlay (today `$O(log n)$` is shown in a
  clean monospace style rather than typeset).
- Support for more coding sites beyond LeetCode.
- Publishing `undoomed` to PyPI so `pip install undoomed` works for everyone
  (today it's an editable local install).
- Publishing the VS Code extension to the Marketplace (today it installs from a locally-built VSIX).

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

### Prompt 17 — On-page controls, left/right panel, service worker, tidier popup (2026-06-07)

Follow-up fixes from real use: the panel overlapped LeetCode's top bar, there
was no way to choose its side, reviews could only be started from the toolbar
popup, and the popup footer showed an ugly giant session id.

**1. The panel no longer overlaps the top bar, and you can choose its side.**
- The drawer now starts **below** LeetCode's top navigation, so it never covers
  the timer/avatar/Premium controls.
- New **Settings → "On-page panel position"** (Left / Right), plus a **⇄ flip**
  button right on the panel header to switch sides in one click. The choice is
  saved and even updates live if you change it in Settings. (This replaces the
  earlier on/off overlay toggle — the panel is now the single results surface.)

**2. Request a review *on the page*, not just from the popup.**
- The on-page launcher is now a split pill: **⏻ Un-doomed** (open/close the
  panel) + **Review** (start a review immediately). The panel also has its own
  big "Request Socratic Review" button. So you can run a full review without ever
  opening the toolbar popup — similar to how the "Push to GitHub" extension adds
  an on-page button. (It's a floating launcher we fully control rather than one
  injected into LeetCode's own toolbar, which would break every time LeetCode
  renames its CSS classes.)

**3. New service worker (`background.js`) — the shared review engine.**
- All the review work (read code + language from Monaco, scrape the description,
  read settings, call the backend, save history, drive the panel) moved into a
  Manifest V3 **service worker**. Both the popup and the on-page buttons now just
  send it one message. This is also what makes the on-page button possible: a
  content script can't do a privileged cross-origin fetch or read `window.monaco`
  on its own, but the service worker can. `config.js` was tweaked to publish the
  backend URL on `globalThis` so the worker can `importScripts` it (one URL,
  still the single edit point).

**4. Tidier popup.** The toolbar popup is now a thin trigger (button + status +
a one-line tip). The footer shows the **current problem name** (truncated),
instead of the long `student_…__slug` id that was wrapping and breaking the
layout. The unused result card was removed.

**Files touched:** `background.js` (new), `manifest.json`, `config.js`,
`content.js`, `popup.html`, `popup.js`, `popup.css`, `options.html`,
`options.js`. Backend unchanged.

**Verified:** all JS passes a Node syntax check; `manifest.json` is valid JSON;
no stray invisible characters. (No backend change, so the Prompt 16 backend
verification still stands.)

**To get the fixes:** reload the unpacked extension (Extensions → reload). No
backend redeploy needed for this prompt.

### Prompt 18 — Resizable panel + skip the API call when code is unchanged (2026-06-07)

Two refinements from real use: the panel was too narrow to read the model's code
examples comfortably, and hitting Review again with no code changes wasted an API
call for the same answer.

**1. The panel is now resizable.**
- Drag the **inner edge** to change width, the **bottom edge** to change height,
  or the **bottom corner** for both. Min sizes keep it usable; it won't grow past
  the viewport.
- Your size is remembered (per browser). The **⇲** button next to "Request
  Socratic Review" — or **double-clicking any edge** — resets it to default.
- The default width was widened (≈520px) so code examples are readable out of the
  box.

**2. No wasted API calls when nothing changed.**
- The reviewed code is now saved with each history entry. When you click Review,
  the service worker compares your current code with the last reviewed code for
  that problem. If they're identical, it **skips the backend call** and re-shows
  your previous result with a note: *"No changes in your code since the last
  review…"*. The toolbar popup says the same in its status line.
- This protects your tokens from accidental double-clicks and "let me re-read
  that" re-runs. (Any real edit, however small, counts as a change and runs a
  fresh review.)

**Files touched:** `background.js` (no-change guard + store code), `content.js`
(resize handles, reset button, note banner, wider default), `popup.js` (status),
`manifest.json` (version 1.2.0). Backend unchanged.

**Verified:** all JS passes a Node syntax check; no stray invisible characters.

**To get the fixes:** reload the unpacked extension (Extensions → reload).

### Prompt 19 — Constraint-aware edge-case reviews (2026-06-08)

**Problem:** The Edge-Case Executioner was raising faults for scenarios that the
problem's own Constraints explicitly rule out — e.g. "does not handle an empty
array" when the constraint says `1 ≤ descriptions.length ≤ 10^4`, or "no root
found" when the problem guarantees a valid tree. These were noise, not real bugs,
and wasted the student's time chasing hypothetical impossibilities.

**Root cause:** The Executioner's system prompt told it to look hard at "empty
inputs, single-element inputs, duplicate values…" with no instruction to first
check whether those scenarios are actually possible given the stated constraints.

**Fixes — two complementary layers:**

**1. Backend prompt (`socratic_reviewer.py`) — the primary fix.**
- Added a prominent **CRITICAL RULE** at the top of the Executioner's system
  prompt: "Read the Constraints first. NEVER raise a fault for any scenario
  that the stated constraints guarantee cannot occur." Three concrete examples are
  given (empty array, no root, duplicate child) so the model knows exactly what
  to skip.
- The human message now labels the task: *"read the Constraints section carefully
  before auditing"* and ends with *"faults that can actually occur given the
  stated constraints"*.
- The `ExecutionerSchema.issues` field description was tightened to say *"within
  the stated problem constraints"* — so even the structured-output contract
  reinforces the rule.

**2. Frontend scraping (`content.js`) — surface the Constraints as a labelled block.**
- `scrapeDescription()` now walks the description DOM looking for a "Constraints"
  heading. When found, the following bullet points are extracted and appended as a
  clearly-labelled block: *"CONSTRAINTS (hard limits — do not raise issues that
  violate these): …"*. This makes the constraints impossible to miss in the
  prompt, even if they were buried deep in a long description.
- The full description text (which already contained the constraints) is still
  included; the extracted block is additive, not a replacement.

**Files touched:** `src/undoomed/socratic_reviewer.py` (Executioner system
prompt + schema), `content.js` (constraint extraction in `scrapeDescription()`).
Extension UI unchanged; backend logic unchanged.

**Verified:** `socratic_reviewer.py` parses cleanly (`ast.parse`); `content.js`
passes `node --check`.

**To get the backend fix:** redeploy the backend on Render (the prompt change
only takes effect server-side). Reload the unpacked extension for the improved
constraint scraping.

### Prompt 20 — Settings button on the panel + remembered model dropdown (2026-06-08)

Two quality-of-life requests: make Settings reachable straight from the on-page
panel, and stop making the user retype model ids (remembering only the ones that
actually work).

**1. Settings reachable from the panel.**
- The panel header gained a **⚙ settings** button, and the panel now has a
  **footer** showing the active **provider · model** that doubles as a second
  Settings link. Either takes you to the full Settings page (where the model and
  API key live). Because a content script can't open the options page directly,
  the panel asks the service worker (new `UNDOOMED_OPEN_OPTIONS` message →
  `chrome.runtime.openOptionsPage()`).
- The footer label stays in sync: change your provider/model in Settings and the
  panel updates live (via a `chrome.storage.onChanged` listener).

**2. The model field is now a "remembered models" dropdown.**
- On the Settings page the free-text model box became a **dropdown**. It lists,
  per provider, every model that has **passed a Test connection** — so you pick a
  known-good model instead of retyping (and can't fat-finger one that 404s).
- It always offers **"Default — <model>"** (use the provider's default) and
  **"+ Add a new model…"** (reveals a text box to type a new id). When a new
  model passes **Test connection**, it's saved to the list for that provider and
  selected automatically.
- Stored under a new key `undoomed_valid_models` = `{ provider: [model, …] }`.
  Switching providers shows that provider's own remembered models. (Note: this
  remembers *models*; the provider list itself stays the four the backend
  supports — adding an arbitrary provider name wouldn't have a working client.)
- Also fixed a stale label: the provider dropdown showed Gemini's default as
  `gemini-2.0-flash`; it now matches the real default `gemini-2.5-flash`.

**Files touched:** `content.js` (⚙ button, footer, open-settings message, live
label), `background.js` (`UNDOOMED_OPEN_OPTIONS` handler), `options.html`
(model dropdown + add-new input, Gemini label), `options.js` (valid-model
history, dropdown population, record-on-test), `manifest.json` (version 1.3.0).
Backend unchanged.

**Verified:** all JS passes a Node syntax check; `manifest.json` is valid JSON
(now v1.3.0); no stale `modelEl` references remain.

**To get the fixes:** reload the unpacked extension (Extensions → reload). No
backend redeploy needed for this prompt.

### Prompt 21 — Greyscale + blue theme, dark mode everywhere (2026-07-06)

A visual redesign of all three extension surfaces (toolbar popup, Settings
page, on-page panel), plus a few quality-of-life improvements. **No backend
changes** — this prompt is entirely about how the extension looks and feels.

**1. New color theme: greyscale with a single blue accent.**
The old indigo/purple accent (and the green/orange/red status colors) are gone.
Everything is now shades of grey — near-white surfaces, charcoal text — with
**one blue** (`#2563eb`) reserved for the things that deserve attention: the
primary "Request Socratic Review" buttons, links, the active tab, keyboard
focus rings, and the "Approved" badge. In plain terms: if it's blue, it's
important; everything else stays quiet. Status verdicts translate like this:

- **Approved** → soft **blue** badge (the happy highlight).
- **Needs revision** → **inverted** badge (dark background, light text) — it
  stands out by contrast, not by color.
- **Pending / errors** → grey, or dark **bold** text for errors, so problems
  are still unmissable without adding a second color.

**2. Dark mode.**
- The **popup** and **Settings** page now follow your computer's light/dark
  preference automatically (via the CSS `prefers-color-scheme` rule) — same
  greyscale, flipped: charcoal surfaces, light text, a slightly brighter blue.
- The **on-page panel** is smarter: instead of following the *computer*, it
  follows **LeetCode itself**. LeetCode marks its dark mode with a `dark` label
  on the page; the panel watches that label (a `MutationObserver`) and flips
  its own colors the moment you toggle LeetCode's appearance — so you never get
  a glaring white panel on a dark site. If LeetCode ever stops using that
  label, the panel falls back to the computer preference.
- Under the hood all the panel's colors moved into **CSS variables** (one list
  of named colors for light, one for dark) instead of being hard-coded in
  dozens of places — future re-theming is a ten-line change.

**3. Small but meaningful UI upgrades.**
- **Keyboard focus rings**: tabbing through any Un-doomed button now shows a
  clear blue outline (`:focus-visible`), an accessibility win that doesn't
  affect mouse users.
- **The popup footer now shows the active provider · model** (e.g.
  "⚙ openai · gpt-4o-mini"), exactly like the on-page panel's footer — you can
  see what will answer *before* you spend tokens, and clicking it opens
  Settings.
- **Dead CSS removed**: `popup.css` still carried ~100 lines of styles for the
  result card and Markdown that the popup stopped rendering back when results
  moved on-page (Prompt 17). Deleted.
- Inactive tabs and history cards now brighten on hover, so everything
  clickable *feels* clickable.

**Files touched:** `popup.css` (rewrite: palette, dark mode, focus rings, dead
styles removed), `options.css` (rewrite: palette, dark mode, focus rings),
`popup.js` (provider · model footer label), `content.js` (STYLE moved to CSS
variables, new palette, `pageIsDark()` + `applyTheme()` + `watchPageTheme()`),
`manifest.json` (version 1.4.0), `documentation.md` (§6.4, §6.5, this entry).
`index.html` (the marketing landing page) intentionally keeps its own look for
now.

**Verified:** all extension JS passes a Node syntax check; `manifest.json` is
valid JSON (now v1.4.0); a repo-wide search confirms no indigo hex codes remain
in any extension file.

**To get the changes:** reload the unpacked extension (Extensions → reload),
then refresh the LeetCode tab. No backend redeploy needed.

### Prompt 22 — Icons, landing-page re-theme, error red, server health chip (2026-07-06)

Prompt 21 ended with four suggestions; this prompt implements all of them.
**No backend changes** (the health check uses the `GET /health` doorway the
server has had since Prompt 7).

**1. The extension finally has icons.**
- New `icons/` folder with the brand mark — a **blue rounded square with a
  white "?"** (Socratic hints = questions) — at 16, 48, and 128 pixels. Drawn
  once at high resolution and scaled down so even the tiny toolbar version
  stays crisp.
- `manifest.json` now declares them under `icons` and `action.default_icon`,
  so the toolbar button, the `chrome://extensions` page, and any future store
  listing show the real logo instead of a generic letter.

**2. The landing page (`index.html`) now matches the extension.**
The marketing page swapped its indigo/purple accents for the same greyscale +
blue system: the headline gradient, buttons, hover glows, and the little
"Available" badges (previously green) are all blue now; the fake-terminal demo
uses ink-grey for the faults line and blue for the hints line instead of
amber/fuchsia. Same calm layout, same faint grid — just one accent color
everywhere.

**3. Errors get one muted red.**
Prompt 21 made errors bold dark text; in practice that can read as "just
another sentence". Errors in the popup and Settings page now use a **single
muted red** (`#b91c1c` light / `#f87171` dark) — the one deliberate exception
to greyscale + blue, reserved strictly for "something went wrong". Success,
warnings, and everything else stay blue/grey.

**4. Settings page: a live server health chip.**
- A small chip at the top of the Settings form pings the backend's
  `GET /health` probe and shows a **blue dot + "Server connected"** or a **red
  dot + "Server unreachable… start it with `undoom serve`"** — so you know the
  server is down *before* you fill in a form or burn a review click.
- It checks when the page opens, re-checks after every **Test connection**,
  and you can click the chip to re-check manually (a grey pulsing dot means
  "checking…"). The check gives up after 4 seconds, so a dead server can't
  hang the page.

**Files touched:** `icons/icon16.png` / `icon48.png` / `icon128.png` (new),
`manifest.json` (icons + version 1.5.0), `index.html` (palette swap),
`popup.css` + `options.css` (`--danger` red for errors), `options.html` +
`options.js` (health chip + `/health` ping), `documentation.md` (§4, §6.2,
§10.1, §13, this entry).

**Verified:** all extension JS passes a Node syntax check; `manifest.json` is
valid JSON (v1.5.0) and its three icon paths exist on disk; a repo-wide search
finds no indigo/amber/fuchsia/green leftovers in any HTML/CSS/JS file; the
16px icon was eyeballed and is legible.

**To get the changes:** reload the unpacked extension (Extensions → reload) —
the new icon appears immediately (pin it!). Refresh the LeetCode tab. If the
landing page is deployed on Vercel, redeploy it to publish the new look.

### Prompt 23 — Website rebuilt on Vite + React + Bun, terminal fonts (2026-07-06)

The single-file landing page became a real, modern web app — built by parallel
AI agents orchestrated in one go — and the whole project adopted the terminal
font stack. **No Python backend changes** (and the site needs no backend at
all — it stays fully static).

**1. The new `website/` app.**
- Stack: **Bun** (fast JavaScript runtime + package manager, installed this
  prompt), **Vite** (build tool), **React 19** (UI components), **Tailwind
  CSS v4** (styling via design tokens instead of a CDN script).
- Same content and greyscale + blue brand as before, now split into 10 small
  components (`Nav`, `Hero`, `HowItWorks`, `Downloads`, `Faq`, `Cta`,
  `Footer`, plus a shared accessible `Modal` and the two modals built on it).
- Two genuine upgrades over the old page: **automatic dark mode** (design
  tokens are CSS variables that flip with the OS preference) and the
  **monospace terminal look** — the entire site is set in
  `Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro`.
- **The extension download is real now.** A build step
  (`website/scripts/make-extension-zip.mjs`) zips the actual extension
  (manifest, scripts, styles, icons — 14 files) into
  `public/undoomed-extension.zip`, so "Get Beta Access" serves the current
  version instead of pointing at a file that never existed.
- Old `index.html` **deleted**; `README`, `vercel.json`, `.vercelignore`,
  `.gitignore`, and this document all updated to match. One subtle fix along
  the way: `.vercelignore`'s `src/` rule (meant for the Python backend) would
  also have excluded `website/src/` from deploys — it's now anchored to the
  repo root as `/src/`.

**2. How it was built (for the curious).**
The main assistant scaffolded the project skeleton (config, design tokens, app
shell, zip script), then dispatched **three parallel Claude Opus agents**, each
owning a disjoint set of component files — nav/hero/footer, how-it-works/
downloads, and modals/FAQ/CTA. Because no two agents touched the same file,
no isolated worktrees were needed. All three finished in under a minute; the
site then built successfully on the first try.

**3. Terminal fonts in the extension too.**
Every monospace surface in the extension (code snippets and code blocks in
reviews, the API-key field, the problem-slug label) now uses the same
`Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro` stack. Prose stays in
the system sans font for readability. `manifest.json` bumped to **1.5.1**.

**Files touched:** `website/**` (new: app scaffold + 10 components + zip
script), `index.html` (deleted), `vercel.json` (Bun build), `.vercelignore`
(anchor `/src/`, exclude build artifacts), `.gitignore` (generated zip),
`README.md` (layout + deploy blurb), `popup.css` / `options.css` /
`content.js` (font stacks), `manifest.json` (1.5.1), `documentation.md`
(§4, §13, §15.2, this entry).

**Verified:** `bun install` + `bun run build` succeed (Vite bundles 40
modules; zip contains 14 entries); a local preview server returned HTTP 200
for the page, the extension zip (35.5 KB), and `agent.md`, and the built
bundle contains the hero copy; all extension JS still passes Node syntax
checks; `manifest.json` is valid JSON at v1.5.1.

**To get the changes:** extension — reload it (Extensions → reload). Website —
push to GitHub and let Vercel build (it now runs Bun automatically), or run
`cd website && bun run dev` locally.

### Prompt 24 — Fix: "bun is not recognized" in an already-open terminal (2026-07-06)

No code changed. Running `bun run dev` right after Prompt 23 failed with
*"bun is not recognized"* in a PowerShell window that was open **before** Bun
was installed — terminals only read the PATH when they start. Fix: open a new
terminal, or refresh the current one with
`$env:Path += ";$env:USERPROFILE\.bun\bin"`. A troubleshooting note was added
to §13 so the next person isn't surprised.

### Prompt 25 — Website redesign: cream editorial look + live animated demo (2026-07-06)

A full visual redesign of the website (extension untouched), modeled on
**auxia.io**: modern, sleek, editorial — deliberately not the generic
"AI-generated site" look. Built the same way as Prompt 23: the main assistant
set the design system and contracts, then **three parallel Claude Opus agents**
rewrote the components (hero + demo / nav + footer + CTA / sections + modals)
in ~96 seconds.

**1. New canvas and type.**
- Background is now the requested warm cream **`#f0efe3`**; text is near-black
  ink, borders are hairlines, and blue stays scarce (CTAs, links, highlights).
- Font family is now **`PP Neue Montreal, Arial, sans-serif`** as requested.
  Note: PP Neue Montreal is a **commercial font** (Pangram Pangram) that can't
  legally be hot-linked, so visitors see Arial until the licensed `.woff2`
  files are dropped into `website/public/fonts/` — a ready-to-uncomment
  `@font-face` block with instructions sits at the top of `src/index.css`.
  The monospace stack from Prompt 23 remains for code and small labels.
- The site is now **light-only**: the previous auto dark mode would have
  replaced the cream with dark grey for dark-mode users, defeating the point.
- Gradient text, glow blobs, and the dot grid are gone; big type, whitespace,
  and hairline rules carry the design. Buttons are now ink-black pills that
  turn blue on hover.

**2. The hero is a live product demo.**
The static terminal mock-up was replaced by `BrowserDemo.jsx`: a Mac-Safari
window containing a mock LeetCode "Two Sum" page — problem description on the
left, a dark code editor with a subtly buggy nested-loop solution on the
right, and the extension's blue launcher pill floating at the bottom. Every
16 seconds it plays the whole story: the Review button "clicks", the panel
slides in, "Reviewing your code…" spins, then a NEEDS REVISION verdict, two
edge-case faults (`nums = [3,3]`, the missing no-pair return) and two
**Socratic hint questions** appear one by one — showing exactly what the
first agent does: hints, never the answer. Technical notes: pure CSS
keyframes (no JavaScript timers, so it can never drift or leak), honors
"reduce motion" system settings by showing the finished state, and is marked
decorative for screen readers with a hidden text description.

**3. Emojis → icons.**
Every emoji on the site (🧩 ⌨️ 🆚 📄 🛡️ 🤔 ✨ …) was replaced with thin-stroke
**lucide-react** icons (Puzzle, Terminal, Code, FileText, Shield, HelpCircle,
Sparkles, Copy, Download, X, ArrowRight, Plus, Lock). One wrinkle: the brand
icon `Chrome` was removed from lucide v1, so the extension uses the `Puzzle`
icon instead — and a find-and-replace that briefly renamed Chrome-the-browser
to "Puzzle" in two sentences was caught and fixed before shipping.

**Files touched:** `website/src/index.css` (new tokens + font-face note),
`website/index.html` (theme-color), `website/package.json` (+ lucide-react),
all 11 component files (10 rewritten, `BrowserDemo.jsx` new),
`documentation.md` (§13, this entry). Extension files and `manifest.json`
unchanged.

**Verified:** `bun run build` succeeds (1,797 modules); a local preview
returned HTTP 200 and the built bundle contains the cream color, the
PP Neue Montreal stack, the demo keyframes, and the hero copy; an emoji scan
of `website/src` finds zero emojis; all lucide icon names were checked against
the installed package (that's how the missing `Chrome` was caught).

**To see it:** `cd website`, then `bun run dev` — or push and let Vercel
rebuild.

### Prompt 26 — "Un-Doomed", real Safari chrome, clickable demo steps (2026-07-06)

Five refinements from a design review of the new site, plus a brand tweak.

**1. The name is now "Un-Doomed" (capital D).**
Every place a person sees the name — the website, the extension popup, the
on-page panel, the Settings page, the Chrome extension name, `agent.md`, the
README — now spells it **Un-Doomed**. Technical identifiers stay lowercase on
purpose (`undoomed` package, `undoomed_*` storage keys, file names): renaming
those would break saved settings and installs for zero user benefit. Older
Change Log entries keep the spelling they shipped with. Extension version →
**1.5.2** (reload it to see the new name).

**2. The demo's browser chrome now matches real Safari** (from the provided
screenshot): traffic lights, sidebar toggle, back/forward chevrons, privacy
shield, a centered address pill with the lock and a reload icon, and share /
new-tab / tab-overview buttons on the right — all thin lucide icons.

**3. The demo's code editor gained line numbers** (1–6 in a proper gutter),
like a real editor.

**4. A clickable step indicator sits under the demo** — four mono-label chips
with a blue lightning bolt, threaded on a blue rail (modeled on the provided
example): *Review requested → Analyzing code → Edge-case faults → Socratic
hints*. The active chip is filled ink; clicking any chip jumps the animation
to that exact step. To make that possible the demo was rebuilt from a fixed
16-second CSS loop into a small React **state machine**: each step
auto-advances after its duration, and a click simply sets the step (the timer
re-arms from there). Reduced-motion users get the finished state with no
auto-play — but the chips still respond.

**5. Small polish:** selecting text anywhere on the site now highlights in the
brand blue (`::selection`), and the "Install the CLI" button (plus the other
outlined buttons) now fills blue on hover like the primary buttons do.

**Files touched:** `website/src/components/BrowserDemo.jsx` (rebuilt),
`Hero.jsx` / `Downloads.jsx` / `AgentModal.jsx` (hover fills), `index.css`
(`::selection`), the rename across `website/src/**`, `website/index.html`,
`agent.md` (all three copies), `popup.*`, `options.*`, `content.js`,
`background.js`, `README.md`, and `manifest.json` (name + v1.5.2);
`documentation.md` (§13, this entry).

**Verified:** `bun run build` succeeds; the preview serves HTTP 200; the
built bundle contains "Un-Doomed" (7×) and zero old-spelling leftovers, the
step-chip labels, the Safari address pill, and the `::selection` rule; all
extension JS passes Node syntax checks; `manifest.json` is valid at v1.5.2;
every lucide icon name used was checked against the installed package.

### Prompt 27 — The crossed-phone logo, LeetCode editor chrome, livelier sections (2026-07-06)

A brand and polish pass across the site AND the extension, from a provided
logo concept.

**1. The new logo: a phone that spells "D", crossed out.**
The provided concept — a phone whose body forms the letter **D** with a slash
through it (doomscrolling, crossed out) — is now the product mark, drawn in
the brand blue. It exists in three forms:
- `website/src/components/LogoMark.jsx` — a reusable vector drawing (props:
  size, stroke color, and a "knockout" color that must match the background,
  which creates the clean gap around the slash);
- new `icons/icon16/48/128.png` for the extension toolbar (blue mark on a
  cream rounded square — rendered from the vector via a headless browser,
  since no SVG rasterizer was installed);
- inline drawings inside the extension's popup, Settings page, on-page panel
  header, and the launcher pill (white version on the blue pill) — these use
  CSS variables, so they recolor themselves in dark mode.

**2. The header wordmark.** "Un-Doomed" in the nav (and footer) is now a
logotype: the mark plus the name in semibold, with **"Doomed" struck through
in blue** — the same slash story as the logo, so it's unmistakably a brand,
not just a word.

**3. The demo looks more like a real editor.** The code pane's header is now
LeetCode-style: a "Code" label on the left and a **Python3 language selector**
(with chevron) plus reset/maximize icons on the right — plus the line numbers
from Prompt 26.

**4. Step indicator: bolt → blinking dot.** The lightning bolt on the step
chips is gone; the active chip now carries a small **blinking status dot**
(soft blue on the filled chip), inactive chips a static muted dot. The blink
stops for reduced-motion users.

**5. "How it works" icons.** The three reviewers got better-fitting icons in
hover-reactive bordered tiles: **Crosshair** (Edge-Case Executioner hunts
faults), **MessageCircleQuestion** (Socratic Tutor asks), **Braces**
(Clean-Code Critic reviews style). Tiles tint blue on hover.

**6. FAQ is no longer static.** Rewritten from native disclosure elements to
a controlled accordion: questions highlight on hover, the plus icon rotates
into an ✕, and answers **slide open smoothly** (a CSS grid-rows animation —
no JavaScript height measuring). One answer open at a time.

**7. The extension now uses the website font** — `PP Neue Montreal, Arial,
sans-serif` in the popup, Settings page, and on-page panel (falls back to
Arial until the licensed font files exist; code stays in the mono stack).
Extension version → **1.5.3**.

**Files touched:** website — `LogoMark.jsx` (new), `BrowserDemo.jsx`,
`Nav.jsx`, `Footer.jsx`, `HowItWorks.jsx`, `Faq.jsx`; extension —
`popup.html/.css`, `options.html/.css`, `content.js`, `icons/*.png`,
`manifest.json` (1.5.3); `documentation.md` (§6.2, §13, this entry).

**Verified:** site builds; preview serves HTTP 200; the bundle contains the
logo path, the Python3 selector, the blink keyframes, both wordmark strikes
(nav + footer), and the FAQ animation classes; all extension JS passes Node
syntax checks; the launcher's slash was caught rendering blue-on-blue during
review and fixed to white; the regenerated 128px icon was visually inspected.

**To get it:** reload the extension (new logo + font appear); site: `cd
website && bun run dev` or redeploy.

### Prompt 28 — Fix: "pip install undoomed" wrapped onto two lines (2026-07-06)

Tiny layout fix on the website's CLI download card: the install command could
wrap ("pip install / undoomed") when the card got narrow. The command now
stays on **one line** (`whitespace-nowrap`, a slightly smaller size, and a
truncation guard so extremes ellipsize instead of overflowing). File:
`website/src/components/Downloads.jsx`. Verified with a fresh `bun run build`.

### Prompt 29 — "How it works" becomes a zig-zag scroll journey + favicon fix (2026-07-06)

The static three-column "How it works" grid was replaced with an
**auxia.io-style scroll experience**, and the website favicon finally caught
up with the new logo.

**1. The scroll journey.**
- A vertical **rail** runs through the section; as you scroll, it **fills
  with blue** (the fill height is driven by scroll position, updated at most
  once per frame).
- The three reviewers are **stages pinned to the rail**, and they
  **zig-zag**: stage 1 on the left, stage 2 on the right, stage 3 back on the
  left, with the rail running down the center on desktop (on phones it's a
  single column with the rail on the left). Each stage's node dot on the rail
  turns blue and the content fades up the first time it scrolls into view.
- Each stage is a blue pill (agent icon + name) + its description + a **live
  looping demo card** showing what that agent actually does:
  - **Edge-Case Executioner** — an "edge-case sweep" runs test inputs one by
    one (`nums = []`, `[3,3]`, "no valid pair", the happy path) with ✗/✓
    verdicts, ending on a "3 FAULTS FOUND" chip;
  - **Socratic Tutor** — a chat: a typing indicator, then a question bubble,
    more typing, a second question — closing on "ZERO CODE HANDED OVER";
  - **Clean-Code Critic** — `O(n²)` gets struck through, `O(n)` lands in
    blue, and a three-item style checklist ticks in.
  All three demos share one 9-second clock with explicit per-element timing
  windows, so every card resets cleanly (an earlier draft used staggered
  delays, which would have let late elements linger into the next loop — 
  caught and fixed before shipping). Reduced-motion users see the finished
  state of each card.
**2. Favicon fix (user-reported):** the site's browser-tab icon was still the
old "?" tile because `website/public/icon48.png` had never been refreshed —
it's now the crossed-phone logo. (Browsers cache favicons aggressively; a
hard refresh or new tab may be needed to see it.)

**Files touched:** `website/src/components/HowItWorks.jsx` (rebuilt),
`website/public/icon48.png` (new logo). Extension unchanged.

**Verified:** `bun run build` succeeds; preview serves HTTP 200; the bundle
contains the rail-fill logic (`scaleY`), the IntersectionObserver, and all
three demo cards' copy; the favicon file now byte-matches the extension's
48px icon.

### Prompt 30 — The connector now snakes like auxia's + black agent pills (2026-07-06)

Two refinements to the Prompt 29 scroll journey, matching the provided
auxia.io reference more closely.

**1. The line snakes instead of running straight.** The straight center rail
became a **path that travels with the content**: down the left edge beside
the Executioner, a rounded 90° turn across the page, down the right edge
beside the Tutor, and back across to the left for the Critic. Small captions
sit in the middle of each horizontal run, breaking the line the way auxia's
do ("FAULTS BECOME QUESTIONS", "LOGIC SOUND — STYLE NEXT"). Technically: the
component measures where each stage actually sits (re-measuring on any
resize), builds an SVG path with rounded corners from those positions, lays a
grey version underneath, and reveals a blue copy on top using a stroke-dash
offset tied to scroll position — so the blue line literally draws itself
along the bends as you scroll. Phones keep the simple straight left rail.

**2. Black agent pills.** The agent-name bubbles in the "How it works"
section are now **ink-black** with the cream text, with the icon in soft blue
— matching the requested look.

**Files touched:** `website/src/components/HowItWorks.jsx`;
`documentation.md` (§13, this entry). Extension unchanged.

**Verified:** `bun run build` succeeds; the bundle contains the dash-offset
draw logic, the measuring ResizeObserver, the horizontal-run captions, and
the black pill styling.

### Prompt 31 — A real VS Code extension + downloads polish (2026-07-06)

The "coming soon" card finally shipped: Un-Doomed now has a **VS Code
extension**, plus two small website touches.

**1. The VS Code extension (`vscode-extension/`).**
A small, dependency-free extension (plain JavaScript, no build step) that
speaks the exact same `/api/review` protocol as the browser extension and
CLI:
- **"Un-Doomed: Request Socratic Review"** (`Ctrl+Alt+U` / `Cmd+Alt+U`)
  reviews the file you're editing. The first review of a file asks *what the
  code is supposed to do* (remembered per file; change it with **"Set Task
  Description"**). The verdict, edge-case faults, and Socratic hints open in
  a cream-themed panel beside the editor.
- Reviews of the same file share a **stable thread id** (a hash of workspace
  + file path), so the backend's attempt counter and memory work exactly
  like the other clients.
- **"Un-Doomed: Set API Key"** stores the key in VS Code's **secret
  storage** — never in plain-text settings (a plain setting exists only as a
  fallback). Provider/model/server URL/server secret live under Settings →
  Un-Doomed.
- The language is auto-detected from the editor and sent along, driving the
  language-correct style review.
- Files: `package.json` (manifest), `extension.js` (all logic),
  `README.md`, `.vscode/launch.json` (press-F5 testing), `.vscodeignore`,
  `icon.png` (the crossed-phone logo).

**2. Website: downloads section polish.**
- Hovering any download card now **slightly enlarges it** (a 1.03 scale with
  the darker border), per request.
- The "AVAILABLE" chips are gone (and with VS Code live, "COMING SOON" went
  with them; the lone "TEMPLATE" chip was dropped too for a consistent
  look).
- The VS Code card is now active: **"Get the extension"** opens a new setup
  modal (package the VSIX → Install from VSIX → set key and review).

**Files touched:** `vscode-extension/**` (new client), website
`Downloads.jsx` / `VsCodeModal.jsx` (new) / `App.jsx`; `documentation.md`
(repo map, §13, §16, this entry).

**Verified:** `extension.js` passes a Node syntax check and its
`package.json` is valid JSON; the site builds and the bundle has zero
"Available" leftovers, the scale hover, and the new modal.

**To test the VS Code extension:** open the `vscode-extension` folder in VS
Code and press **F5** (see §16 of this doc and the extension's README for
packaging and publishing).

### Prompt 32 — VS Code sidebar presence + smooth card hover (2026-07-06)

**1. The VS Code extension now lives in the Activity Bar** (the icon strip on
VS Code's left edge), like Claude Code does:
- A new **Un-Doomed icon** appears in the Activity Bar. VS Code uses these
  icons as alpha *masks* (it repaints them in the theme color), so the
  crossed-phone mark needed a real SVG mask for the slash gap instead of a
  painted-over background — that's the new `media/mark.svg`.
- Clicking it opens a **sidebar panel**: the logo + wordmark, a blue
  **Request Socratic Review** button, quick actions for setting the per-file
  task and the API key, and — after a review — the **last verdict** (file
  name, APPROVED/NEEDS REVISION pill, fault count, attempt number) with a
  "Reopen review panel" button. It's a webview view that styles itself with
  VS Code's own theme variables, so it looks native in any theme.
- The **review tab in the editor now carries the Un-Doomed icon** (the
  panel's `iconPath`), so it reads as a branded tab like the screenshot.

**2. Website: the download-card hover no longer jitters.** The scale-on-hover
now runs on the GPU (`transform-gpu` + `will-change-transform` promote each
card to its own compositor layer, so the browser stops re-rasterizing the
text every frame) with a slightly gentler 1.02 scale and a smoother 300ms
ease-out.

**Files touched:** `vscode-extension/package.json` (viewsContainers + views),
`vscode-extension/extension.js` (UndoomedViewProvider, tab icon, sidebar
updates), `vscode-extension/media/mark.svg` (new), website `Downloads.jsx`
(hover fix); `documentation.md` (this entry).

**Verified:** `extension.js` passes a Node syntax check; `package.json` is
valid JSON; the site rebuilds cleanly. To see the sidebar: reopen the
`vscode-extension` folder and press **F5**, then click the Un-Doomed icon in
the Activity Bar of the development window.

### Prompt 33 — Settings button in the VS Code sidebar (2026-07-06)

Quick follow-up: the sidebar had no way to reach the provider/model settings.
A new **"Settings — provider · model · server"** button in the Un-Doomed
sidebar opens VS Code's Settings pre-filtered to the `undoomed.*` options
(provider, model, server URL, server secret). The API key still uses its own
button because it goes to secret storage, not settings. File:
`vscode-extension/extension.js`; verified with a Node syntax check.

### Prompt 34 — Clarification: where VS Code review results appear (2026-07-06)

No code change — a question about the VS Code extension's layout. Answer:
results open in a **reusable editor tab beside your code** (branded with the
Un-Doomed icon), because hints are meant to be read next to the code being
fixed. The **sidebar** is the launcher/status surface: action buttons,
settings shortcuts, and a compact summary of the last verdict with a
"Reopen review panel" button. Rendering the full review inside the sidebar
was offered as an optional future tweak.

### Prompt 35 — FAQ matched to the page system (2026-07-06)

The FAQ section didn't match its neighbors: it sat in a narrower centered
column, with a smaller feel and plain rows. Now (verified against full-page
screenshots of the live build):

- **Same width and alignment** as every other section (`max-w-6xl`), in the
  page's editorial split: the "/ 03 FAQ" eyebrow, "Calm by design" heading,
  and a new one-line intro on the LEFT; the questions on the RIGHT — same
  shape as the "How it works" stages.
- **More interactive:** each question now carries a mono index (01/02/03)
  that lights up blue; hovering a row turns the question blue and nudges it
  right; the plus rotates into an ✕; the open row stays highlighted; answers
  still slide open smoothly and are indented to align with the question text.
- **Type scale matched:** questions at the body-large size (bigger on
  desktop), answers slightly larger and capped at a readable line length.
- Bonus fix spotted in the screenshots: the closing panel's eyebrow read
  "/ 05" after "/ 03" — it's now "/ 04".

**Files touched:** `website/src/components/Faq.jsx` (rebuilt), `Cta.jsx`
(numbering); `documentation.md` (§13, this entry).

**Verified:** built and screenshotted the real page at desktop width —
before/after — confirming the FAQ's left edge now lines up with the download
cards, the numbered accordion renders, and the CTA reads "/ 04".

### Prompt 36 — Fix: "Install the CLI" scrolled too deep (2026-07-06)

Clicking the hero's "Install the CLI" button jumped so far into the
Downloads section that the CLI card sat flush at the top of the window —
partly under the sticky header, with no section context. Fix: anchor targets
now reserve space when scrolled to (`scroll-margin-top`) — 72px of sticky-nav
clearance for the section links (How it works / Downloads / FAQ) and a
generous 220px for the deep `#cli` link, so the CLI card lands with the
section heading still visible above it. File: `website/src/index.css`;
verified with a fresh build.

### Prompt 37 — CLI button scroll matched to the extension button (2026-07-06)

The hero's "Get the browser extension" scroll (landing at the top of the
Downloads section, heading in view) was declared the reference; "Install the
CLI" now points at the same `#downloads` anchor, so both buttons land
identically. The `#cli` deep anchor keeps a standard 72px sticky-nav
clearance for any future direct links. Files: `website/src/components/Hero.jsx`,
`website/src/index.css`; verified with a fresh build.

### Prompt 38 — README brought in sync (2026-07-06)

Refreshed the top-level `README.md` after the landing-page work:

- **Brand match:** the title now reads "Un-~~Doomed~~" (Doomed struck
  through) to match the site's new one-stroke wordmark.
- **VS Code client added:** the architecture diagram and the "Project
  layout" list previously showed only the browser extension, CLI, and
  `agent.md`. The `vscode-extension/` folder is a real fourth client that
  talks to the same server, so it now appears in both places.

The rest of the README (quick start, backend deploy, the three-reviewer
explanation) was already accurate and left untouched. File: `README.md`
(and this Change Log entry).

### Prompt 38 — Why the on-page panel still showed the OLD logo (2026-07-06)

No code change — a diagnosis. The user reported that the extension's on-page
panel (the drawer that appears on a LeetCode problem) still showed the **old
"⏻" power-symbol logo** even after refreshing the tab and reloading the
extension in the browser's settings.

**What we checked (and what it proved):**
- The panel's logo is **not an image file** — it's drawn as an inline SVG
  right inside `content.js` (the `.mark` element in the panel header). So
  swapping the `icons/*.png` files can never change it; only reloading
  `content.js` can.
- The `content.js` on disk (updated today, 02:05) already contains the **new
  blue crossed-phone mark** from Prompt 27. The downloadable
  `undoomed-extension.zip` was compared byte-for-byte against the source and
  is **identical** — so neither the folder nor the download is stale.
- The browser's own records (Chrome *and* Edge "Secure Preferences") show the
  extension is loaded **unpacked straight from
  `C:\Users\Animesh Gosain\Downloads\undoomed`** — the very folder with the
  new logo. No stale copy of it exists anywhere else on the machine.
- Git history confirms the old `.mark` used to be the literal glyph
  `<div class="mark">⏻</div>` (Prompt 16 era) — which is exactly the dark
  circular emblem in the screenshot.

**Conclusion:** the files are correct; the browser was simply still running the
**old injected copy** of `content.js`. Two traps cause this:
1. **LeetCode is a single-page app.** Clicking around inside LeetCode is *not*
   a real page load, so the new content script is never injected — the old
   panel keeps running. Only a true reload (Ctrl+Shift+R, or a fresh tab)
   re-injects it.
2. **The extension is installed in both Chrome and Edge.** Reloading it in one
   browser does nothing for a LeetCode tab open in the other.

**The reliable fix (any one of these, in the browser you actually use):**
1. Extensions page (`chrome://extensions` / `edge://extensions`) → click the
   **Reload (↻)** icon on the Un-Doomed card. Confirm it reads **v1.5.3** and
   the toolbar icon is now the blue mark.
2. Then **hard-reload** the LeetCode tab: **Ctrl+Shift+R**, or close it and
   open a brand-new tab.
3. If it *still* shows the old ⏻ mark: **Remove** the extension, then **Load
   unpacked** → pick `C:\Users\Animesh Gosain\Downloads\undoomed` again, and
   hard-reload the tab. A fresh load cannot keep a stale copy.

### Prompt 42 — Fix: the count badge showed an empty dot on 0-history problems (2026-07-06)

The user pointed out the white circle still appeared on the launcher even when
the History tab said "No past reviews for this problem yet." A real bug — and
the reason no number was ever visible: on a fresh problem there's *no count to
show*, so it rendered as an empty dot.

**Root cause:** the badge's CSS set `display: inline-grid`, and an explicit
author `display` rule **beats the `[hidden]` attribute's `display: none`** (the
UA rule for `hidden` has lower priority). So `els.badge.hidden = true` in
`refreshHistory()` never actually hid the badge — it stayed on-screen (empty)
for every problem, showing a number only when history happened to exist.

**Fix:** one CSS line — `.launch__badge[hidden] { display: none; }` — whose
selector (class + attribute) outranks the plain `.launch__badge` rule, so the
`hidden` attribute wins again. Now the badge is **completely gone at 0 saved
reviews** and shows the legible count only when there's ≥1.

**Files touched:** `content.js` (one CSS rule),
`website/public/undoomed-extension.zip` (rebuilt). Part of the **v1.6.0** reload.

**Verified:** `content.js` passes a Node syntax check; the launcher was
rendered from the real source in both states — the default `hidden` badge (no
saved reviews) shows a **clean pill with no dot**, and a badge with a count
shows the number clearly.

### Prompt 41 — Drop the launcher's "Review" button; make the count legible (2026-07-06)

Two follow-ups on the launcher pill:

**1. Removed the "Review" button.** Since clicking **Un-Doomed** opens the
panel — which already has its own "Request Socratic Review" button — the
separate quick-Review button only saved one click. The launcher is now a
**single pill** (`[⊘ Un-Doomed  ③]`); its bolt icon and split-pill styling
were removed with it. (The in-panel review button and the keyboard/programmatic
review path are untouched — no review functionality was lost.)

**2. Made the count number actually visible.** The white circle is the
**saved-reviews count** for the current problem, but the digit was too small
and faint to read (it looked like an empty dot). It's now a larger circle with
a **bold, fixed dark-blue number (`#1e40af`) on white**, so it reads clearly on
the blue pill in any theme. It still only appears when there's at least one
saved review (no confusing empty dot when there are none) — it's a real count,
not a static placeholder.

**Files touched:** `content.js` (launcher markup + styles, removed the
quick-Review button and its click handler), `website/public/undoomed-extension.zip`
(rebuilt). Still part of the **v1.6.0** reload.

**Verified:** `content.js` passes a Node syntax check with zero leftover
references to the removed button (`ud-review-quick` / `launch__review` /
`launch__bolt`); the single pill was rendered at true 1× size in a headless
browser (3× pixel density) and screenshotted — the "Un-Doomed" pill shows a
crisp, readable count and no Review button.

### Prompt 40 — Launcher pill polish + explaining the "white dot" (2026-07-06)

The user asked what the small **white dot** on the floating launcher pill
(the `[⊘ Un-Doomed  ● | Review]` button at the bottom-right of a LeetCode
page) was, and to improve that button's look.

**What the dot is:** it's the **history-count badge** — how many past Socratic
reviews are saved for the problem you're on. It only appears when at least one
review is saved, and clicking **Un-Doomed** opens the panel where the
**History** tab lists them (reopening a past review costs no API tokens). It
looked like a meaningless dot only because the number was tiny and faint.

**The polish (in `content.js`):**
- The badge is now bigger, bolder, and rounder with a subtle shadow, so the
  **count is clearly legible**, and it carries a tooltip ("Saved reviews for
  this problem") on hover.
- **"Review" gained a small lightning-bolt icon**, so the primary action reads
  as an action at a glance.
- The whole pill now **lifts slightly and deepens its shadow on hover**, has a
  crisp pressed state, and a touch more padding — so it feels like a button,
  not a static label.

**Files touched:** `content.js` (launcher styles + markup),
`website/public/undoomed-extension.zip` (rebuilt). Shipped as part of the same
**v1.6.0** reload as the free-floating window (Prompt 39).

**Verified:** `content.js` passes a Node syntax check; the launcher's real CSS
+ markup were rendered in a headless browser on both light and dark pages and
screenshotted — the badge clearly shows its count, the bolt + "Review" read
correctly, and the pill looks crisp in both themes.

### Prompt 39 — The on-page panel is now a free-floating, drag-anywhere window (2026-07-06)

Until now the review panel on LeetCode was a **drawer pinned to the left or
right edge** of the screen. You could resize its width/height and flip which
side it clung to, but it always stayed glued to an edge. The request: let you
**put the window anywhere on screen and resize it any way you like** — and
remove the old edge-pinning UI if it no longer fits.

**What the panel does now (in `content.js`):**
- It's a **free-floating window**: grab it **anywhere on its header** (the row
  with the logo and title) and drag it to any spot on the page. The header
  shows a "move" cursor so it's clearly grabbable; clicking the gear or the ✕
  still works normally (a drag that starts on a button is ignored).
- **Resize from any edge or any corner** — eight invisible grab-strips run
  around the window (top, bottom, left, right, and the four corners). Dragging
  the top or left edge moves that edge while the opposite one stays put, just
  like a real desktop window. A sensible minimum size stops it being crushed.
- **It remembers where you left it.** The window's position *and* size are
  saved in the browser, so it reopens exactly where you last put it. (Old
  saved sizes still load; only the "remember position" part is new.)
- It now looks like a proper floating card: **rounded corners, a hairline
  border, and a soft drop shadow**, instead of a full-height edge drawer.
- If you ever lose the window off-screen, the **↘ reset button** (next to
  "Request Socratic Review") — or a **double-click on any resize edge** —
  snaps it back to the default size and corner. It also re-clamps itself when
  you resize the browser window, so it can never get stranded out of reach.

**UI removed (superseded — no functionality lost):**
- The **⇄ "flip to other side" button** in the panel header — you can place
  the window anywhere now, so flipping between two fixed sides is obsolete.
- The **"On-page panel position: Right / Left" dropdown** in the extension's
  Settings page (`options.html` / `options.js`) — same reason; its old stored
  value is simply ignored.

**Files touched:** `content.js` (floating-window drag + 8-way resize +
position/size persistence, replacing the side-drawer code), `options.html` /
`options.js` (removed the side selector), `manifest.json` (version →
**1.6.0**), `website/public/undoomed-extension.zip` (rebuilt so the download
matches), `documentation.md` (this entry).

**Verified:** `content.js`, `options.js`, `popup.js`, and `background.js` all
pass a Node syntax check; `manifest.json` is valid JSON at v1.6.0; every
element the code wires up was confirmed present in the markup and no
references to the removed side/flip code remain; the panel's real CSS +
markup were rendered in a headless browser and screenshotted — confirming the
floating rounded window, header, tabs, body, footer, and launcher all draw
correctly with the flip button gone.

**To get it:** reload the unpacked extension (confirm it now reads **v1.6.0**)
and hard-reload the LeetCode tab, exactly as in the previous entry.

### Prompt 38 — A livelier hero (2026-07-06)

The hero read as static next to the animated sections below it. Four calm
additions, all in the site's existing visual language:

- **The headline's accent word cycles**: "Start *building.*" swaps through
  *thinking. / solving. / shipping.* every ~2.6 seconds with a quick
  fade-and-rise, always in the brand blue.
- **A blinking status dot** now leads the eyebrow line — the same "live"
  dot used by the demo cards and step chips (one shared CSS class now lives
  in `index.css`).
- **The primary button's arrow nudges right on hover**, matching the
  download cards' reactive feel.
- **A mono stat strip** sits under the buttons — "3 REVIEWERS · 4 PROVIDERS
  · 0 ANSWERS HANDED OVER" — each item tinting blue on hover.

All motion stops for reduced-motion users (the word stays on "building.",
the dot stays lit). Files: `website/src/components/Hero.jsx`,
`website/src/index.css`. Verified with a fresh build — the cycling words,
stat strip, and dot styles are all present in the shipped bundle.

### Prompt 39 — Fix: jittery headline word cycle (2026-07-06)

The cycling accent word made the hero jitter: each word is a different
width, so the centered headline re-flowed and re-centered on every swap.
Fix: all four words now live stacked in one grid cell, so the slot is
permanently as wide as the widest word — the line never moves; the active
word simply cross-fades and rises in place while the old one sinks out.
(This also simplified the code: no more mid-swap state, just one index.)
File: `website/src/components/Hero.jsx`; verified with a fresh build.

### Prompt 40 — Clarification: the hero's blinking dot (2026-07-06)

No code change — a design question. The blinking dot before the hero eyebrow
is the site's shared "live" motif (the demo cards and the active step chip
use the same dot), added for visual continuity and a small sign of life
above the fold. It reports nothing real — it's rhythm, not information — and
removing it (or freezing it to a static dot) was offered as a one-line
change if it reads as noise.

### Prompt 41 — Wordmark fix: the hyphen and strikethrough now line up (2026-07-06)

**The observation:** in the "Un-Doomed" wordmark, the black hyphen after "Un"
and the blue strikethrough over "Doomed" sat at slightly different heights and
didn't line up.

**Why they didn't:** they were two different things. The "-" was a normal black
text character, placed by the font. The strikethrough was a separate blue CSS
line, placed by the font's own (different) strikethrough metric. Two independent
rulers → they rarely match, and no amount of nudging lines them up reliably
across sizes.

**The fix:** make the hyphen and the strikethrough the *same line*. There's now
one continuous blue stroke that begins as the hyphen right after "Un" and carries
straight through the middle of "Doomed". Because it's a single drawn line, the
two halves can't fall out of alignment — there's nothing to align. It also
reinforces the brand idea: the same blue stroke that crosses out the phone icon
now crosses out "Doomed". The real text "Un-Doomed" is kept intact underneath for
copy/paste and screen readers (the visible hyphen is hidden so the stroke stands
in for it).

**Files:** new shared component `website/src/components/Wordmark.jsx` (so the
logo can't drift between places); wired into `website/src/components/Nav.jsx` and
`website/src/components/Footer.jsx`, which previously each hand-rolled the markup.
Everything in the component is sized in `em`, so it scales cleanly at any size.
Verified by running the site and screenshotting the header.

### Prompt 41 — Typewriter headline + blinking dot removed (2026-07-06)

**1. The headline now types.** Instead of cross-fading, the accent word is
**typed out character by character** (~75ms each), held for ~2 seconds,
**backspaced** (faster, ~42ms), and replaced by the next word — building. →
thinking. → solving. → shipping. — with a blinking caret bar after the text,
exactly like a terminal. The width-stable slot from the previous fix stays
(invisible copies of all four words size the space), so the centered line
still never moves while characters change. Screen readers get a stable
"Start building." sentence (the animation is marked decorative), and
reduced-motion users see the full first word with a still caret.

**2. The hero's blinking eyebrow dot is gone**, as requested (it was
decorative rhythm, not information). Its now-unused shared CSS class was
deleted too — the demo cards keep their own dots, which do indicate the
running animations.

**Files touched:** `website/src/components/Hero.jsx`,
`website/src/index.css`. Verified with a fresh build: caret styles present,
zero leftover references to the removed dot class.

### Prompt 42 — Headline lines now left-align (2026-07-06)

"Stop scrolling." and "Start <typed word>" were each centered independently,
so the two S's didn't line up. The headline's two lines now live inside one
inline block that is centered as a whole but left-aligned internally — both
lines share the same left edge while the block stays visually centered in
the hero. File: `website/src/components/Hero.jsx`; verified with a fresh
build and a screenshot of the running dev server showing the S's aligned.

### Prompt 43 — Clarification: is the logo a different font from the hero? (2026-07-06)

No code change — a question. **The logo, the hero, and all body text use the
same font.** The whole site draws from one family defined once in
`website/src/index.css`: `--font-sans: "PP Neue Montreal", Arial, sans-serif`.
Tailwind applies that as the default, and nothing (not the hero `<h1>`, not the
`Wordmark` logo) overrides it. The only other face is the monospace one, used
just for the small uppercase eyebrow labels and code.

**Important caveat:** PP Neue Montreal is a commercial font that is **not
bundled** — the `@font-face` block is commented out and there are no font files
in `public/fonts/`. So today the site falls back to the second name in the
stack, **Arial**, everywhere — hero and logo alike. The logo is also live text
(the `Wordmark` component), not a baked-in image, so there's no hidden "logo
font." Any apparent difference is **weight and size**, not typeface: the logo is
`font-semibold` (600) at ~17px, the hero is `font-medium` (500) at ~72px.

To actually change this: (a) drop licensed PP Neue Montreal `.woff2` files into
`public/fonts/` and uncomment the `@font-face` block to switch the whole site
off Arial; or (b) give `Wordmark` its own display font if the logo should look
distinct from body text. Neither was done — offered as options.

### Prompt 43 — Fix: caret blinked through a third, half-faded state (2026-07-06)

The typewriter caret used a `steps(2, start)` animation, which splits each
blink segment into two jumps — producing a half-opacity in-between frame
(the "third color"). Now `steps(1, end)`: fully visible for half the cycle,
fully invisible for the other half, nothing in between — a hard terminal
blink. File: `website/src/index.css`; verified with a fresh build.

### Prompt 44 — Logo weight now matches the hero (2026-07-06) — provisional

Following the font clarification (Prompt 43), the ask was to make the logo
match the hero. They already share one font family; the only difference was
**weight** — the logo was `font-semibold` (600), the hero is `font-medium`
(500). Changed the `Wordmark` from `font-semibold` to `font-medium` so the
logo now renders at the hero's exact weight (both currently Arial until the
real PP Neue Montreal face is added). One-word change in
`website/src/components/Wordmark.jsx`; verified by running the site and
screenshotting the nav logo above the hero headline. **Provisional** — kept
trivially revertible (swap `font-medium` back to `font-semibold`) in case the
lighter logo isn't preferred.

### Prompt 45 — Reverted: logo back to its own weight (2026-07-06)

The lighter (hero-matching) logo from Prompt 44 wasn't preferred. Reverted
`Wordmark` from `font-medium` back to `font-semibold`, so the logo is once
again the heavier weight that stands on its own in the nav/footer rather than
matching the hero. One-word change in `website/src/components/Wordmark.jsx`;
production bundle rebuilt so the running preview reflects the revert. Net effect
of Prompts 44+45 on the codebase: none — back to the pre-Prompt-44 state.

### Prompt 44 — Demo matches real LeetCode dark UI + branded panel header (2026-07-06)

Two fixes to the hero demo, verified against a screenshot of the running
build:

**1. The problem pane is now LeetCode-dark.** The mock "Two Sum" description
panel had stayed cream; it now matches the official site's dark theme
(compared against a provided screenshot): dark grey `#262626` background,
white title, LeetCode's teal "Easy" chip, light-grey body text with
`nums` / `target` rendered as inline code chips, and the Input/Output
example on a subtly lighter inset — sitting next to the darker editor pane,
just like the real product.

**2. The review panel header is branded now.** The plain "Un-Doomed" text —
which read as boring/out of place — uses the logotype treatment: semibold
with the blue strike through "Doomed", matching the nav, footer, and VS Code
sidebar.

**Files touched:** `website/src/components/BrowserDemo.jsx`;
`documentation.md` (this entry). Verified: fresh build + screenshot shows
the dark pane, teal chip, code chips, and the struck wordmark in the panel.
