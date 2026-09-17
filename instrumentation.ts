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
      digest,
    });
  } catch {
    // Reporting cannot be allowed to throw inside the error path itself: it
    // would replace a fault we could record with one we cannot.
    // ERROR-HANDLING.md rule 1, fourth case.
  }
};
