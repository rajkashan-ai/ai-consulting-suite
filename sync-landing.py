#!/usr/bin/env python3
"""
Copy the landing page into this app, and point its buttons at the real sign-in.

WHY A SCRIPT
UI/landing-page.html is the design, edited in another session, and it is a
single self-contained file with its images inlined so it can be published as a
mockup. This app needs the same file with one change: the four buttons that say
"Try it for free" currently point at "#signin", which is an anchor to nothing.

Copying it by hand is how the two drift apart. So this copies it, makes exactly
that one substitution, and refuses if the substitution finds nothing, which is
what would happen if somebody renamed the anchor.

USE
    python3 sync-landing.py          copy it across
    python3 sync-landing.py --check  exit 1 if the copy is out of date
"""
import sys, pathlib, re

HERE = pathlib.Path(__file__).parent
SOURCE = HERE.parent / "UI" / "landing-page.html"
TARGET = HERE / "public" / "landing.html"

PLACEHOLDER = 'href="#signin"'
REAL = 'href="/sign-in"'


def build() -> str:
    html = SOURCE.read_text(encoding="utf-8")
    count = html.count(PLACEHOLDER)
    if count == 0:
        raise SystemExit(
            f"No {PLACEHOLDER} found in {SOURCE.name}. Either the anchor was renamed or the\n"
            f"sign-in buttons were removed. Fix this script rather than shipping a landing\n"
            f"page whose buttons go nowhere."
        )
    print(f"  {count} sign-in buttons pointed at /sign-in")
    return html.replace(PLACEHOLDER, REAL)


def main() -> int:
    wanted = build()
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != wanted:
            print(f"  !  {TARGET.name} is out of date. Run: python3 sync-landing.py")
            return 1
        print(f"  ok {TARGET.name}")
        return 0

    TARGET.parent.mkdir(exist_ok=True)
    TARGET.write_text(wanted, encoding="utf-8")
    print(f"  -> {TARGET.relative_to(HERE)}  ({len(wanted):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
