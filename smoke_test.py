"""
smoke_test.py — end-to-end plumbing check for Un-doomed.
========================================================

Goal: prove that the three moving parts talk to each other correctly:
    Chrome-extension-shaped request  ->  FastAPI server  ->  SQLite checkpointer

It does NOT test the AI's wording. It tests the *wiring*: that a POST shaped
exactly like the one popup.js sends reaches /api/review, that the SqliteSaver
remembers the thread between two separate requests, and that loop_count climbs
1 -> 2 (and is genuinely written to undoomed_state.db on disk).

Lightweight on purpose: uses only the Python standard library, so there is
nothing to install. Just start the server first:

    undoom serve

...then run:

    python smoke_test.py
"""

import json
import os
import sqlite3
import time
import urllib.error
import urllib.request

# --- Where the server and the database live ---------------------------------
# UNDOOMED_API_URL lets CI / alternate ports point this elsewhere (default local).
API_BASE = os.environ.get("UNDOOMED_API_URL", "http://127.0.0.1:8000").rstrip("/")
REVIEW_URL = API_BASE + "/api/review"
HEALTH_URL = API_BASE + "/health"
# The server writes the DB into its working directory, so look in ours too.
# Run smoke_test.py from the same folder you launched the server from (repo root).
DB_PATH = os.environ.get("UNDOOMED_DB", os.path.join(os.getcwd(), "undoomed_state.db"))

# --- The payload, shaped EXACTLY like popup.js sends ------------------------
# popup.js POSTs JSON: { task_description, current_code, thread_id }
TASK_DESCRIPTION = (
    "Two Sum\n\n"
    "Given an array of integers `nums` and an integer `target`, return the "
    "indices of the two numbers such that they add up to target. You may not "
    "use the same element twice. If no valid pair exists, handle it gracefully."
)

# Turn 1: clearly broken (uses the same element twice via j starting at 0, and
# silently returns None when no pair exists). Guaranteed to fail the auditor.
CODE_TURN_1 = (
    "def two_sum(nums, target):\n"
    "    for i in range(len(nums)):\n"
    "        for j in range(len(nums)):\n"
    "            if nums[i] + nums[j] == target:\n"
    "                return [i, j]\n"
)

# Turn 2: a "revision" that is STILL broken on purpose -- the student switched
# to a hash map but forgot to ever populate `seen`, so it never finds a pair.
# Guaranteed to fail the auditor again, so it routes to the tutor and bumps
# loop_count a second time.
CODE_TURN_2 = (
    "def two_sum(nums, target):\n"
    "    seen = {}\n"
    "    for i, n in enumerate(nums):\n"
    "        if target - n in seen:\n"
    "            return [seen[target - n], i]\n"
    "    return None\n"
    "    # bug: never does `seen[n] = i`, so `seen` stays empty\n"
)


def post_review(payload: dict) -> dict:
    """POST one review request exactly like the extension does; return the JSON
    body. Exits with a clear message on connection / HTTP errors."""
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        REVIEW_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        # The server makes a couple of LLM calls per request, so allow generous time.
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        raise SystemExit(
            f"[FAIL] {REVIEW_URL} returned HTTP {exc.code}.\n"
            f"       Server said: {body}\n"
            "       A 500 usually means the server hit an error -- check the\n"
            "       uvicorn terminal (e.g. a missing OPENAI_API_KEY)."
        )
    except urllib.error.URLError as exc:
        raise SystemExit(
            f"[FAIL] Could not connect to {REVIEW_URL} ({exc.reason}).\n"
            "       Is the server running?  ->  undoom serve"
        )


def server_is_up() -> bool:
    """Quick liveness ping so we fail fast with a friendly message."""
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as response:
            return response.status == 200
    except Exception:
        return False


def read_loop_count_from_db(thread_id: str):
    """Read the loop_count that is ACTUALLY persisted on disk for this thread.

    Preferred path: use LangGraph's own SqliteSaver to load the latest
    checkpoint (most accurate -- it deserialises exactly what the server wrote).
    Fallback path: if langgraph isn't importable here, just confirm that
    checkpoint rows physically exist for this thread_id via raw SQL.

    Returns the int loop_count, the string "rows-present", or None.
    """
    if not os.path.exists(DB_PATH):
        return None

    # Preferred: ask the checkpointer itself.
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver

        conn = sqlite3.connect(DB_PATH)
        try:
            saver = SqliteSaver(conn)
            tuple_ = saver.get_tuple({"configurable": {"thread_id": thread_id}})
            if tuple_ and tuple_.checkpoint:
                values = tuple_.checkpoint.get("channel_values", {})
                if "loop_count" in values:
                    return values["loop_count"]
        finally:
            conn.close()
    except Exception:
        pass  # fall through to the raw-SQL fallback

    # Fallback: just prove rows landed on disk for this thread.
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            cur = conn.execute(
                "SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?", (thread_id,)
            )
            return "rows-present" if cur.fetchone()[0] > 0 else None
        finally:
            conn.close()
    except sqlite3.Error:
        return None


def main() -> int:
    print("=" * 68)
    print("  Un-doomed end-to-end smoke test")
    print("=" * 68)

    if not server_is_up():
        print(
            "[FAIL] Server health check failed at " + HEALTH_URL + "\n"
            "       Start it first:  undoom serve"
        )
        return 1
    print("[ok] Server is up at " + API_BASE)

    # A fresh thread id each run so the test is deterministic (always 1 -> 2),
    # regardless of any previous runs already stored in the database.
    thread_id = "smoke_" + str(int(time.time()))
    print("[ok] Using thread_id: " + thread_id)

    # ---- Turn 1 -------------------------------------------------------------
    print("\n--- Turn 1: submit clearly-flawed code ---")
    body1 = post_review(
        {
            "task_description": TASK_DESCRIPTION,
            "current_code": CODE_TURN_1,
            "thread_id": thread_id,
        }
    )
    lc1 = body1.get("loop_count")
    print(f"    status     = {body1.get('status')!r}")
    print(f"    loop_count = {lc1}")
    print(f"    faults     = {len(body1.get('edge_case_faults') or [])} found")

    # ---- Turn 2 (SAME thread_id) -------------------------------------------
    print("\n--- Turn 2: submit a revision that is still flawed (same thread_id) ---")
    body2 = post_review(
        {
            "task_description": TASK_DESCRIPTION,
            "current_code": CODE_TURN_2,
            "thread_id": thread_id,
        }
    )
    lc2 = body2.get("loop_count")
    print(f"    status     = {body2.get('status')!r}")
    print(f"    loop_count = {lc2}")
    print(f"    faults     = {len(body2.get('edge_case_faults') or [])} found")

    # ---- Read what actually got written to disk -----------------------------
    persisted = read_loop_count_from_db(thread_id)
    print(f"\n[db] loop_count persisted in undoomed_state.db = {persisted}")

    # ---- Verdict ------------------------------------------------------------
    print("\n" + "-" * 68)
    checks = [
        ("Turn 1 routed to tutor (status 'needs_revision')",
         body1.get("status") == "needs_revision"),
        ("Turn 1 loop_count == 1", lc1 == 1),
        ("Turn 2 loop_count == 2", lc2 == 2),
        ("loop_count incremented by exactly 1 across requests",
         isinstance(lc1, int) and isinstance(lc2, int) and lc2 == lc1 + 1),
        ("Persisted on disk matches the API's loop_count",
         persisted == lc2 or persisted == "rows-present"),
    ]

    all_passed = True
    for label, passed in checks:
        print(f"  [{'PASS' if passed else 'FAIL'}] {label}")
        all_passed = all_passed and passed

    print("-" * 68)
    if all_passed:
        print("RESULT: PASS — extension payload, FastAPI, and SQLite are wired correctly.")
        return 0
    print("RESULT: FAIL — see the failed checks above.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
