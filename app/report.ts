/**
 * Tell the server something went wrong in the browser.
 *
 * Error boundaries do not catch errors in event handlers or in async work after
 * a render: the Next.js docs say so plainly, and that is most of what a button
 * does. Those have to be caught by hand, which we already did, and then
 * reported, which we did not.
 *
 * A catch that tells the customer and throws the reason away satisfies half of
 * CWE-390. "Could not copy it" could be the clipboard being refused or the
 * export endpoint being down, and those have different fixes.
 *
 * Never throws and never awaits anything the caller cares about. Reporting a
 * fault must not create one, and the customer is already being told.
 */
export function report(
  error: unknown,
  where: string,
  workspaceId?: string | null,
  severity: "stopped" | "fault" | "noted" = "fault",
): void {
  try {
    void fetch("/api/problem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        where,
        kind: "client",
        severity,
        workspaceId: workspaceId ?? null,
      }),
      // The browser may be leaving the page. This asks it to finish anyway.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting is best effort by definition. ERROR-HANDLING.md rule 1,
    // fourth case: expected, and said out loud.
  }
}
