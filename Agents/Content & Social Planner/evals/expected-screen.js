/**
 * THE SCREEN WE DESIGNED BY HAND, AS DATA. The target the pipeline must hit.
 *
 * Until 15 September the planner was a hand-typed screen and a library of rules
 * with no application between them: zero imports from `src/` in the markup,
 * zero site fetches in `src/`. A green suite hid it, because a test proves a
 * function works and never that anything calls it.
 *
 * So the hand-built screen was lifted out of the markup into this object. It is
 * the thing the dynamic pipeline is measured against, and the thing that gets
 * edited when the design moves. Two assertions hang off it:
 *
 *   1. the screen in `UI/workspace.html` still matches this  (it was extracted
 *      from there, so this starts true and stays true only if kept honest)
 *   2. the pipeline's output matches this, field by field, and where it cannot
 *      the difference is a finding rather than a failure
 *
 * On the real site the second one already differs, and correctly: the pipeline
 * reads what the page actually publishes and the hand-built copy was written
 * from a source that had more in it.
 *
 * Frozen 2026-09-15 from the screen as designed.
 */
export const EXPECTED_SCREEN = {
  "sections": [
    "What you have posted",
    "How often we suggest you post",
    "What you sound like",
    "This week",
    "Resize a photo",
    "The rest of the month",
    "What we did not write"
  ],
  "stats": [
    {
      "figure": "2 this week",
      "label": "Tuesday and Friday"
    },
    {
      "figure": "2 blanks",
      "label": "A line from you"
    },
    {
      "figure": "2 of 9 done",
      "label": "So far this month"
    }
  ],
  "posts": [
    {
      "day": "Tuesday 22 September",
      "channel": "Instagram",
      "kind": "Useful",
      "words": "Beard sculpting is not a trim. A trim takes the length off. Sculpting sets the line: where the cheek stops, where the neck starts, and where the corner of the jaw sits. Get those three wrong and a good beard looks untidy however short it is. This one took about twenty minutes. [say what he came in asking for] It is £20, and it holds its shape for roughly three weeks before it needs touching.",
      "shot": "Before and after, same chair, same light, taken from slightly above so the jawline shows."
    },
    {
      "day": "Friday 25 September",
      "channel": "Facebook",
      "kind": "Useful",
      "words": "Do you need to book? You can book through NearCut, it takes about thirty seconds and you pick your own slot. [walk-ins: say whether you take them and when is quiet] We are open six days, closed Sunday. If you are coming for a cut and beard together, book it as the one job rather than two separate ones, or the slot will be too short and the beard gets rushed.",
      "shot": "Your phone showing the booking screen, held up in front of the shop window."
    }
  ],
  "weeks": [
    {
      "state": "Done",
      "about": "What each cut is, and what it costs",
      "meta": "2 posts · 15 SEPT"
    },
    {
      "state": "This week",
      "about": "The work itself, close up",
      "meta": "2 posts · 22 SEPT"
    },
    {
      "state": "Ahead",
      "about": "What people get wrong between cuts",
      "meta": "2 posts · 29 SEPT"
    },
    {
      "state": "Ahead",
      "about": "A normal week, then the ask",
      "meta": "2 posts · 6 OCT"
    },
    {
      "state": "Ahead",
      "about": "The ask",
      "meta": "1 post · 13 OCT"
    }
  ],
  "blanks": [
    "say what he came in asking for",
    "walk-ins: say whether you take them and when is quiet"
  ]
};
