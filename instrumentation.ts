import type { Instrumentation } from "next";

/**
 * Every server error, in one place.
 *
 * Next.js documents `onRequestError` as the hook for tracking server errors:
 * Server Components, Route Handlers and Server Actions. Without it, a failure
 * in the welcome flow or a step endpoint went nowhere at all.
 *
 * The docs warn the error instance may not be the one originally thrown, since
 * React may have processed it, and that `digest` identifies the real type. Both
 * are kept.
 *
 * The import is inside the function on purpose. This file is loaded on every
 * server start, including the Edge runtime, and pulling the database client in
 * at the top would load it into places that cannot use it.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { note } = await import("@/lib/problems");

    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest?: unknown }).digest)
        : null;

    await note(createAdminClient() as never, {
      error: err,
      // The route file, not the request path. "/workspace/[tool]" groups every
      // tool's failures together as one fault, where the path would split them
      // per tool and per workspace and the count would mean nothing.
      where: `${context.routePath} ${request.method}`.trim(),
      kind:
        context.routeType === "render"
          ? "render"
          : context.routeType === "action"
            ? "action"
            : "route",
      /**
       * A render that threw means the page did not load, so they lost what they
       * came for. Found by causing a real crash on 2026-09-17 and seeing it
       * recorded as an ordinary fault: everything through this hook defaulted
       * to the middle answer, and a blank page is not the middle answer.
       *
       * A route handler or an action that throws usually leaves the page
       * standing, so it stays "fault" unless a caller knows better.
       */
      severity: context.routeType === "render" ? "stopped" : "fault",
      action: `${context.routeType} ${context.routePath}`.trim(),
      outcome: "failed",
      digest,
    });
  } catch {
    // Reporting cannot be allowed to throw inside the error path itself: it
    // would replace a fault we could record with one we cannot.
    // ERROR-HANDLING.md rule 1, fourth case.
  }
};
