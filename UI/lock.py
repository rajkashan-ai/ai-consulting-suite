#!/usr/bin/env python3
"""
A claim on the shared files, so two sessions cannot overwrite each other.

WHY
`app.css`, `workspace.html`, `landing-page.html` and this folder's docs are
edited by two Claude sessions at once. Until 15 September we avoided collisions
by messaging each other, which worked and became its own activity. Raj, that
day: keep the shared assets consistent, stop asking permission. So the
coordination is mechanical now and there is nothing to remember.

USE
    python3 lock.py claim  <who>    exit 0 if you hold it, 1 if someone else does
    python3 lock.py release <who>
    python3 lock.py status

    python3 lock.py claim planner && python3 sync-styles.py; python3 lock.py release planner

RULES
- Claim before writing any shared file. Release straight after. Keep it short.
- A lock older than STALE_AFTER is ignored, so a session that dies mid-write
  cannot block the other for ever.
- It does not stop you writing. It tells you not to, and exits 1 so a chained
  command stops on its own.
"""
import sys, os, time, pathlib

LOCK = pathlib.Path(__file__).parent / ".editing"
STALE_AFTER = 300  # five minutes


def read():
    if not LOCK.exists():
        return None
    try:
        who, at = LOCK.read_text().split(None, 1)
        return who, float(at)
    except ValueError:
        return None


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    who = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("CLAUDE_SESSION", "unknown")
    held = read()
    now = time.time()

    if cmd == "status":
        if not held:
            print("free")
        else:
            age = int(now - held[1])
            print(f"{held[0]} for {age}s" + (" (stale, free to take)" if age > STALE_AFTER else ""))
        return 0

    if cmd == "claim":
        if held and held[0] != who and (now - held[1]) <= STALE_AFTER:
            print(f"held by {held[0]} for {int(now - held[1])}s. Wait and retry.")
            return 1
        LOCK.write_text(f"{who} {now}")
        print(f"claimed by {who}")
        return 0

    if cmd == "release":
        if held and held[0] != who:
            print(f"not yours: held by {held[0]}. Left alone.")
            return 1
        LOCK.unlink(missing_ok=True)
        print("released")
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
