/**
 * One id for one page load, so a click can be followed across the boundary.
 *
 * A browser report and the server error from the same click used to land as two
 * unrelated rows, and "what happened on the server when this person's screen
 * broke" had no answer outside a run. OWASP calls this an interaction
 * identifier and OpenTelemetry calls it a trace id; this is the small version
 * of the same idea, and the decision record says why we are not doing the
 * large one yet.
 *
 * Per page load rather than per session: a session id is a thing to protect,
 * and this is a thing to print in a table we look at. It identifies a visit,
 * not a person, and it is thrown away when the tab closes.
 */
const KEY = "interaction";

export function interactionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const had = window.sessionStorage.getItem(KEY);
    if (had) return had;

    const made =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);

    window.sessionStorage.setItem(KEY, made);
    return made;
  } catch {
    /**
     * Storage refused, which a private window or a locked-down browser does.
     * Expected: correlation is a convenience and losing it must never stop a
     * report. ERROR-HANDLING.md rule 1, fourth case.
     */
    return null;
  }
}
