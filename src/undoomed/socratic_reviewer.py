"""
Un-doomed :: Socratic Code Reviewer (backend orchestration core)
================================================================

This module implements the multi-agent review workflow that powers the
"Un-doomed" developer tool. Student code arrives from a variety of clients
(VS Code extension, JetBrains plugin, CLI, etc.), and this backend:

    1. Hunts for *logic / edge-case* faults first  (the "Executioner").
    2. If logic is broken, it coaches the student with **Socratic questions
       only** -- never handing over runnable code  (the "Tutor").
    3. Once the logic is provably clean, it reviews *style*: Big-O complexity
       and the idiomatic conventions of the submission's own language  (the
       "Critic" -- e.g. PEP 8 for Python, the Google Java Style Guide for Java).

The whole thing is a LangGraph `StateGraph`. State is persisted across
independent client requests via a `MemorySaver` checkpointer, keyed by a
`thread_id`. That means a student can submit, get hints, go away, come back
from a totally separate HTTP request, resubmit, and the system remembers how
many attempts they've made (`loop_count`) -- which lets us escalate from pure
Socratic hinting to a direct solution after repeated struggle.

Design goal: keep every node small, deterministic, and side-effect free with
respect to the graph state. Each node returns ONLY the keys it wants to update;
LangGraph merges those into the persisted checkpoint.

Run the built-in 2-turn demo (after `pip install -e .`):
    # set LLM_PROVIDER + the matching API key (e.g. OPENAI_API_KEY) in a .env file
    python -m undoomed.socratic_reviewer
"""

from __future__ import annotations

import os
from typing import List, TypedDict

# --- Third-party ------------------------------------------------------------
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# LangChain message primitives (provider-agnostic chat message wrappers).
from langchain_core.messages import HumanMessage, SystemMessage

# Provider chat clients (ChatOpenAI / ChatAnthropic / ...) are imported lazily
# inside get_llm() (section 2) so you only need the SDK for the provider you pick.

# LangGraph: the state-machine engine + the in-memory checkpointer that gives
# us cross-request persistence.
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph


# ===========================================================================
# 1. STATE  &  STRUCTURED-OUTPUT SCHEMAS
# ===========================================================================

class ReviewState(TypedDict):
    """The single source of truth that flows through (and persists across) the
    graph for one student session/thread.

    Every node reads from this dict and returns a partial dict of updates.
    LangGraph performs a shallow merge of those updates into the checkpoint,
    so a node that returns ``{"loop_count": 2}`` leaves every other key intact.
    """

    # The problem the student is trying to solve (e.g. "Implement Two-Sum").
    task_description: str

    # The latest code blob the client submitted this turn.
    current_code: str

    # The programming language of the submission (e.g. "java", "python",
    # "cpp"). Detected by the client from the editor. Drives language-correct
    # style review (so a Java submission isn't critiqued against Python's PEP-8).
    language: str

    # Logic / edge-case problems found by the Executioner. Empty list == clean.
    edge_case_faults: List[str]

    # Socratic coaching text shown to the student. NEVER contains runnable code
    # (unless we have escalated to a direct solution after repeated attempts).
    socratic_hints: str

    # Style review (Big-O + PEP-8). Only populated once logic is clean.
    style_feedback: str

    # Lifecycle flag: "pending" -> "needs_revision" -> "approved".
    status: str

    # How many review attempts this thread has accumulated. Drives the
    # "escalate to a direct solution" behaviour and proves persistence works.
    loop_count: int


class ExecutionerSchema(BaseModel):
    """Structured output contract for the Executioner node.

    We force the LLM through ``with_structured_output`` so the verdict is
    machine-readable and deterministic -- no fragile prose parsing, no
    'maybe it's broken' ambiguity. The graph's routing decision depends
    entirely on this, so it must be reliable.
    """

    has_errors: bool = Field(
        description=(
            "True if the code has ANY logic bug, missing edge-case handling, "
            "incorrect return value, or fails to satisfy the task. False ONLY "
            "if the code is functionally correct for every reasonable input."
        )
    )
    issues: List[str] = Field(
        default_factory=list,
        description=(
            "One short, concrete sentence per distinct logic/edge-case fault "
            "that can actually occur given the stated problem constraints. "
            "NEVER include scenarios that the problem's Constraints section "
            "explicitly rules out. Describe WHAT is wrong, never HOW to fix it. "
            "Empty list when has_errors is False."
        ),
    )


# ===========================================================================
# 2. THE MODEL CLIENT  (multi-provider factory)
# ===========================================================================
# Un-doomed is provider-agnostic. Pick a backend with two environment variables:
#
#     LLM_PROVIDER  ->  openai | anthropic | gemini | deepseek   (default: openai)
#     LLM_MODEL     ->  optional model-id override for that provider
#
# ...and set the matching API key (see _PROVIDER_KEYS) in your .env file. Each
# provider's LangChain client is imported lazily, so you only have to
# `pip install` the one you actually use.

# Default model per provider (override any of these with LLM_MODEL).
_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-opus-4-8",  # Anthropic's most capable model
    "gemini": "gemini-2.5-flash",
    "deepseek": "deepseek-chat",
}

# Which env var holds each provider's API key (used for friendly errors).
_PROVIDER_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini": "GOOGLE_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
}

# Friendly aliases -> canonical provider name.
_PROVIDER_ALIASES = {"claude": "anthropic", "google": "gemini"}


def resolve_provider() -> str:
    """Read LLM_PROVIDER from the environment and normalise it."""
    name = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    return _PROVIDER_ALIASES.get(name, name)


# ---------------------------------------------------------------------------
# Offline test provider (LLM_PROVIDER=fake)
# ---------------------------------------------------------------------------
# A deterministic stand-in used by CI / smoke tests: no network, no API key.
# It always reports exactly one fault, so the graph reliably exercises the
# Executioner -> Socratic Tutor path and loop_count increments as expected.
class _FakeStructured:
    def __init__(self, schema):
        self._schema = schema

    def invoke(self, _messages):
        return self._schema(has_errors=True, issues=["stubbed edge-case fault"])


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChatModel:
    def with_structured_output(self, schema):
        return _FakeStructured(schema)

    def invoke(self, _messages):
        return _FakeMessage("Stubbed Socratic response for offline testing.")


def build_llm(provider: str | None = None,
              model: str | None = None,
              api_key: str | None = None):
    """Construct a chat client for a given provider / model / API key.

    Any argument left as None falls back to the environment (LLM_PROVIDER,
    LLM_MODEL, and the provider's standard key variable). This lets the
    standalone script and the smoke test run purely from .env, while the FastAPI
    server can build a client from credentials the **browser extension** supplies
    per request (so each user picks their own provider + key in the extension's
    settings, with no server-side .env required).

    NOTE: temperature is omitted for Anthropic -- Claude Opus 4.8/4.7 reject
    temperature/top_p/top_k (HTTP 400).
    """
    name = (provider or os.getenv("LLM_PROVIDER", "openai")).strip().lower()
    name = _PROVIDER_ALIASES.get(name, name)
    model = (model or os.getenv("LLM_MODEL", "")).strip() or _DEFAULT_MODELS.get(name)

    if name == "fake":
        # Offline test/CI provider — no network, no key required.
        return _FakeChatModel()

    if name == "openai":
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise ImportError("OpenAI provider needs: pip install langchain-openai") from exc
        kwargs = {"model": model, "temperature": 0}
        if api_key:
            kwargs["api_key"] = api_key
        return ChatOpenAI(**kwargs)

    if name == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:
            raise ImportError("Claude provider needs: pip install langchain-anthropic") from exc
        # No temperature (Opus 4.8/4.7 reject sampling params). max_tokens gives
        # the tutor/critic room for a full answer, incl. the direct solution.
        kwargs = {"model": model, "max_tokens": 2048}
        if api_key:
            kwargs["api_key"] = api_key
        return ChatAnthropic(**kwargs)

    if name == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as exc:
            raise ImportError("Gemini provider needs: pip install langchain-google-genai") from exc
        kwargs = {"model": model, "temperature": 0}
        if api_key:
            kwargs["google_api_key"] = api_key
        return ChatGoogleGenerativeAI(**kwargs)

    if name == "deepseek":
        try:
            from langchain_deepseek import ChatDeepSeek
        except ImportError as exc:
            raise ImportError("DeepSeek provider needs: pip install langchain-deepseek") from exc
        kwargs = {"model": model, "temperature": 0}
        if api_key:
            kwargs["api_key"] = api_key
        return ChatDeepSeek(**kwargs)

    raise ValueError(
        f"Unknown provider '{name}'. Choose one of: {', '.join(_DEFAULT_MODELS)}."
    )


# A single env-based client is built once (lazily) for the standalone script and
# the smoke test; the server passes a per-request client via the graph config.
_llm_singleton = None


def get_llm():
    """Return the shared env-based chat client, building it on first use."""
    global _llm_singleton
    if _llm_singleton is None:
        _llm_singleton = build_llm()
    return _llm_singleton


def _llm_from_config(config) -> object:
    """Use the per-request LLM passed in the graph config, else the env default.

    The server stuffs a ready-built client into config["configurable"]["llm"]
    when the extension supplies credentials; otherwise nodes fall back to the
    env-based singleton.
    """
    if config:
        configurable = config.get("configurable") or {}
        llm = configurable.get("llm")
        if llm is not None:
            return llm
    return get_llm()


# ===========================================================================
# 3. AGENT NODES
# ===========================================================================

# Map a raw editor language id (Monaco's getLanguageId(), or a LeetCode label)
# to a clean human name + the idiomatic style guide to review against. Unknown
# languages fall back to a generic "idiomatic style" review.
_LANGUAGE_STYLE = {
    "python": ("Python", "PEP 8"),
    "java": ("Java", "the Google Java Style Guide"),
    "javascript": ("JavaScript", "the Airbnb / StandardJS conventions"),
    "typescript": ("TypeScript", "idiomatic TypeScript conventions"),
    "cpp": ("C++", "the C++ Core Guidelines"),
    "c": ("C", "common C style conventions"),
    "csharp": ("C#", "the Microsoft C# conventions"),
    "go": ("Go", "gofmt / Effective Go conventions"),
    "rust": ("Rust", "the official Rust style (rustfmt) conventions"),
    "ruby": ("Ruby", "the Ruby Style Guide"),
    "kotlin": ("Kotlin", "the official Kotlin coding conventions"),
    "swift": ("Swift", "the Swift API Design Guidelines"),
    "php": ("PHP", "the PSR-12 conventions"),
    "scala": ("Scala", "the Scala Style Guide"),
}


def _language_info(state: ReviewState) -> tuple[str, str]:
    """Return (clean language name, style-guide name) for the submission.

    Normalises common aliases. Falls back to a generic, language-agnostic
    style review when the language is unknown or wasn't supplied.
    """
    raw = (state.get("language") or "").strip().lower()
    aliases = {
        "c++": "cpp", "cplusplus": "cpp", "py": "python", "py3": "python",
        "python3": "python", "js": "javascript", "node": "javascript",
        "ts": "typescript", "cs": "csharp", "c#": "csharp", "golang": "go",
        "kt": "kotlin", "rb": "ruby",
    }
    key = aliases.get(raw, raw)
    if key in _LANGUAGE_STYLE:
        return _LANGUAGE_STYLE[key]
    if raw:
        # Unknown but named language: review against its own idioms generically.
        return (raw, f"idiomatic {raw} conventions")
    return ("the submitted language", "its idiomatic style conventions")


def edge_case_executioner(state: ReviewState, config=None) -> dict:
    """Node 1 -- the merciless logic auditor.

    Evaluates ``current_code`` strictly against ``task_description`` and emits
    a deterministic, structured verdict. It deliberately does NOT touch
    ``loop_count``: a student who writes clean code on the first try should
    never have an attempt counted against them. Ownership of the counter lives
    in ``socratic_tutor``, which only runs when a revision is actually needed.
    """

    system = SystemMessage(
        content=(
            "You are the Edge-Case Executioner, a ruthless senior engineer who "
            "reviews code purely for CORRECTNESS and EDGE CASES. You do not "
            "care about style, naming, or performance here -- only whether the "
            "code produces correct results for every reasonable input.\n\n"
            "CRITICAL RULE — RESPECT PROBLEM CONSTRAINTS:\n"
            "The task description contains explicit CONSTRAINTS (often under a "
            "'Constraints:' heading). Read them FIRST. NEVER raise a fault for "
            "any scenario that those constraints guarantee cannot occur.\n"
            "Examples:\n"
            "  - If '1 <= arr.length', do NOT report 'does not handle empty input'.\n"
            "  - If the problem guarantees a valid tree, do NOT raise 'no root found'.\n"
            "  - If a node is guaranteed to appear at most once as a child, do NOT "
            "    raise 'node listed as child multiple times'.\n"
            "The constraints define the valid input space. Only audit within that "
            "space. Hypothetical violations of stated constraints are NOT faults.\n\n"
            "Within the valid input space, scrutinise especially: smallest allowed "
            "inputs, maximum-size inputs, duplicate values (when allowed), "
            "no-solution-exists cases, off-by-one indexing, reusing the same "
            "element when it shouldn't, and any path that returns nothing (implicit None).\n\n"
            "Report only genuine functional faults. If the code is correct for "
            "all inputs that satisfy the stated constraints, set has_errors=False "
            "and return no issues."
        )
    )
    lang_name, _ = _language_info(state)
    human = HumanMessage(
        content=(
            f"LANGUAGE: {lang_name}\n\n"
            f"TASK DESCRIPTION (read the Constraints section carefully before auditing):\n"
            f"{state['task_description']}\n\n"
            f"SUBMITTED CODE:\n{state['current_code']}\n\n"
            f"Audit this {lang_name} code for logic and edge-case faults that can "
            f"actually occur given the stated constraints."
        )
    )

    # Bind the schema so the model MUST answer in the ExecutionerSchema shape.
    structured_llm = _llm_from_config(config).with_structured_output(ExecutionerSchema)
    verdict: ExecutionerSchema = structured_llm.invoke([system, human])

    # Normalise into the state: faults list is empty iff the code is clean.
    faults = verdict.issues if verdict.has_errors else []

    return {
        "edge_case_faults": faults,
        # Status is provisional here; the downstream node sets the final value.
        # loop_count is intentionally absent -> the checkpointed value is kept.
        "status": "needs_revision" if faults else "pending",
    }


def socratic_tutor(state: ReviewState, config=None) -> dict:
    """Node 2 -- the Socratic coach.

    Receives the Executioner's faults and turns them into *questions* that
    guide the student to discover the bug themselves. Hard constraint: ZERO
    runnable code, markdown code fences, or pseudo-code.

    Escalation: if the student has now looped >= 3 times, frustration risk is
    high, so we append a clear, direct, plain-language solution after the
    questions -- a deliberate, controlled break from pure Socratic method.
    """

    faults = state["edge_case_faults"]
    # This node OWNS the attempt counter. Reaching the tutor means the student
    # must revise, so this submission counts as one attempt. Clean first-try
    # code skips this node entirely and is never penalised. The incremented
    # value is what the >= 3 escalation check below uses.
    loop_count = state.get("loop_count", 0) + 1
    faults_text = "\n".join(f"- {f}" for f in faults) or "- (unspecified)"

    socratic_system = SystemMessage(
        content=(
            "You are the Socratic Tutor for the Un-doomed tool. Your ONLY job "
            "is to help a student discover bugs in their own code by asking "
            "pointed questions.\n\n"
            "ABSOLUTE, NON-NEGOTIABLE RULES:\n"
            "1. NEVER write runnable code, code snippets, function signatures, "
            "   variable assignments, or pseudo-code.\n"
            "2. NEVER use markdown code fences (```), inline backticks, or any "
            "   code formatting.\n"
            "3. NEVER state the fix directly. Lead the student toward it with "
            "   questions only.\n"
            "4. Phrase EVERY point as a question. Be warm, specific, and "
            "   concrete about WHICH input or scenario exposes the flaw, but "
            "   make the student do the reasoning.\n\n"
            "Output a short numbered list of Socratic questions, one per fault."
        )
    )
    lang_name, _ = _language_info(state)
    socratic_human = HumanMessage(
        content=(
            f"LANGUAGE: {lang_name}\n\n"
            f"TASK:\n{state['task_description']}\n\n"
            f"The student's current {lang_name} code is:\n{state['current_code']}\n\n"
            f"Confirmed logic/edge-case faults to guide them toward:\n"
            f"{faults_text}\n\n"
            "Write Socratic questions (no code, no code blocks) that lead the "
            "student to find and understand each fault themselves."
        )
    )

    hints = _llm_from_config(config).invoke([socratic_system, socratic_human]).content

    # --- Escalation: enough struggling, give them the answer outright. -------
    if loop_count >= 3:
        direct_system = SystemMessage(
            content=(
                "You are a patient senior engineer. The student has tried "
                "several times and is at risk of giving up. Provide a clear, "
                "direct, plain-English explanation of exactly what is wrong and "
                "precisely how to fix it. Be concrete and unambiguous. You MAY "
                "describe the fix in plain prose; do not be cryptic."
            )
        )
        direct_human = HumanMessage(
            content=(
                f"LANGUAGE: {lang_name}\n\n"
                f"TASK:\n{state['task_description']}\n\n"
                f"CODE:\n{state['current_code']}\n\n"
                f"FAULTS:\n{faults_text}\n\n"
                f"Explain the fix directly (in terms of {lang_name}) so the "
                "student can move forward."
            )
        )
        direct_solution = _llm_from_config(config).invoke([direct_system, direct_human]).content
        hints += (
            "\n\n"
            "==============================================================\n"
            "DIRECT SOLUTION (you've worked hard on this -- here's the answer)\n"
            "==============================================================\n"
            f"{direct_solution}"
        )

    return {
        "socratic_hints": hints,
        "status": "needs_revision",
        "loop_count": loop_count,
    }


def clean_code_critic(state: ReviewState, config=None) -> dict:
    """Node 3 -- the style & complexity reviewer.

    Only reached when the Executioner found ZERO logic faults, i.e. the code is
    functionally correct. Now -- and only now -- do we critique form: time and
    space complexity (Big-O) and PEP-8 compliance. Logic-clean code earns an
    "approved" status; the style notes are advisory polish.
    """

    lang_name, style_guide = _language_info(state)
    critic_system = SystemMessage(
        content=(
            f"You are the Clean-Code Critic reviewing {lang_name} code. The "
            "submitted code is already logically correct, so do NOT re-check "
            "correctness. Review only:\n"
            "1. COMPLEXITY: State the time and space complexity in Big-O "
            "   notation and say whether a better complexity is achievable.\n"
            f"2. STYLE: Note any style violations against {style_guide} "
            f"   (naming, spacing, line length, idiomatic {lang_name}) and "
            "   suggest concrete improvements.\n\n"
            f"CRITICAL: The code is written in {lang_name}. Review it AS "
            f"{lang_name}. Never assume or rewrite it in another language, and "
            f"never apply another language's style rules.\n\n"
            "Be concise, professional, and encouraging. Here, since the logic "
            "is sound, you MAY reference small code-style examples freely."
        )
    )
    critic_human = HumanMessage(
        content=(
            f"LANGUAGE: {lang_name}\n\n"
            f"TASK:\n{state['task_description']}\n\n"
            f"LOGICALLY-CORRECT {lang_name} CODE:\n{state['current_code']}\n\n"
            f"Provide the Big-O analysis and {style_guide} style review for "
            f"this {lang_name} code."
        )
    )

    feedback = _llm_from_config(config).invoke([critic_system, critic_human]).content

    return {
        "style_feedback": feedback,
        "status": "approved",
    }


# ===========================================================================
# 4. ROUTING
# ===========================================================================

def route_after_executioner(state: ReviewState) -> str:
    """Conditional edge out of the Executioner.

    Non-empty fault list  -> coach the student (socratic_tutor).
    Empty fault list       -> logic is clean, review style (clean_code_critic).
    """
    if state["edge_case_faults"]:
        return "socratic_tutor"
    return "clean_code_critic"


# ===========================================================================
# 5. GRAPH ASSEMBLY  +  PERSISTENCE
# ===========================================================================

def build_graph(checkpointer=None):
    """Wire the nodes into a StateGraph and compile it with a checkpointer so
    state persists across independent thread executions.

    Args:
        checkpointer: Any LangGraph checkpoint saver. If omitted, an in-process
            MemorySaver is used (fine for the standalone demo below). The
            FastAPI server injects a durable SqliteSaver for on-disk persistence.
    """
    builder = StateGraph(ReviewState)

    # Register nodes.
    builder.add_node("edge_case_executioner", edge_case_executioner)
    builder.add_node("socratic_tutor", socratic_tutor)
    builder.add_node("clean_code_critic", clean_code_critic)

    # Entry point: always audit logic first.
    builder.set_entry_point("edge_case_executioner")

    # Branch on the audit result.
    builder.add_conditional_edges(
        "edge_case_executioner",
        route_after_executioner,
        {
            "socratic_tutor": "socratic_tutor",
            "clean_code_critic": "clean_code_critic",
        },
    )

    # Both terminal nodes end the run for this turn.
    builder.add_edge("socratic_tutor", END)
    builder.add_edge("clean_code_critic", END)

    # Default to an in-process MemorySaver (keyed by thread_id) when no saver
    # is supplied -- convenient for the standalone __main__ demo. Callers that
    # need durability across restarts/workers (the API server) pass their own
    # SqliteSaver / Postgres saver instead.
    if checkpointer is None:
        checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer)


# ===========================================================================
# 6. MULTI-TURN SIMULATION  (test harness)
# ===========================================================================

def _print_state(turn_label: str, state: ReviewState) -> None:
    """Pretty-print the relevant slice of state for a turn."""
    print("\n" + "=" * 70)
    print(f"  {turn_label}")
    print("=" * 70)
    print(f"Task        : {state['task_description'].strip().splitlines()[0]}")
    print(f"Status      : {state['status']}")
    print(f"Loop count  : {state['loop_count']}")

    print("\n-- Edge-case faults found by Executioner --")
    if state["edge_case_faults"]:
        for fault in state["edge_case_faults"]:
            print(f"  * {fault}")
    else:
        print("  (none -- logic is clean)")

    if state.get("socratic_hints"):
        print("\n-- Socratic hints returned to the student --")
        print(state["socratic_hints"])

    if state.get("style_feedback"):
        print("\n-- Style / complexity feedback --")
        print(state["style_feedback"])
    print("=" * 70)


if __name__ == "__main__":
    # Pull provider settings and API keys from a local .env file.
    load_dotenv()

    _provider = resolve_provider()
    _key_var = _PROVIDER_KEYS.get(_provider)  # None for the keyless 'fake' provider
    if _key_var and not os.getenv(_key_var):
        raise SystemExit(
            f"LLM_PROVIDER is '{_provider}', but {_key_var} is not set.\n"
            f"    Add {_key_var}=... to your .env file\n"
            f"    (optionally set LLM_PROVIDER / LLM_MODEL too), then re-run."
        )

    graph = build_graph()

    # A SINGLE static thread_id models one continuous student session, even
    # though each turn below is an independent graph invocation (as if it were
    # a separate HTTP request from the client extension).
    config = {"configurable": {"thread_id": "student_session_123"}}

    TASK = (
        "Two-Sum: Given a list of integers `nums` and an integer `target`, "
        "return the indices of the two numbers that add up to target. "
        "Assume there may be no valid pair; handle that gracefully. "
        "You may not use the same element twice."
    )

    # -- TURN 1 -----------------------------------------------------------
    # A badly flawed O(n^2) brute-force attempt: reuses the same element
    # (inner loop starts at 0) and silently returns None when no pair exists.
    turn1_code = (
        "def two_sum(nums, target):\n"
        "    for i in range(len(nums)):\n"
        "        for j in range(len(nums)):\n"
        "            if nums[i] + nums[j] == target:\n"
        "                return [i, j]\n"
    )

    turn1_input: ReviewState = {
        "task_description": TASK,
        "current_code": turn1_code,
        "language": "python",
        "edge_case_faults": [],
        "socratic_hints": "",
        "style_feedback": "",
        "status": "pending",
        "loop_count": 0,
    }

    result1 = graph.invoke(turn1_input, config=config)
    _print_state("TURN 1  -- initial flawed O(n^2) submission", result1)

    # -- TURN 2 -----------------------------------------------------------
    # The student upgrades to an O(n) hash-map approach (good!) but STILL
    # forgets the no-solution edge case (the function falls off the end and
    # returns None). We invoke with the SAME thread_id and pass ONLY the new
    # code -- task_description, loop_count, etc. are restored from the
    # checkpoint. loop_count should therefore advance 1 -> 2, proving memory
    # persisted across the two independent invocations.
    turn2_code = (
        "def two_sum(nums, target):\n"
        "    seen = {}\n"
        "    for i, n in enumerate(nums):\n"
        "        complement = target - n\n"
        "        if complement in seen:\n"
        "            return [seen[complement], i]\n"
        "        seen[n] = i\n"
    )

    turn2_input = {
        "current_code": turn2_code,
    }

    result2 = graph.invoke(turn2_input, config=config)
    _print_state("TURN 2  -- revised O(n) code, same thread_id (memory test)", result2)

    # Explicit persistence assertion for the demo.
    print(
        f"\n[persistence check] loop_count went "
        f"{result1['loop_count']} -> {result2['loop_count']} "
        f"on thread '{config['configurable']['thread_id']}'."
    )
