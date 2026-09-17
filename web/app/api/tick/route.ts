import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { step } from "@/lib/engine";

export const maxDuration = 60;

/**
 * Advance runs nobody is watching.
 *
 * This is what makes "close the tab and come back" true. Without it a run only
 * moves while a page is open, and a customer who shut their laptop halfway
 * through would come back to a half-finished run and a wasted week, because the
 * research only runs fresh once every seven days.
 *
 * Schedule it once a minute. It is harmless to call more often: the lease in
 * the database means two callers cannot advance the same run, so the worst a
 * duplicate call does is nothing.
 *
 * Protected by a shared secret rather than a session, because a scheduler has
 * no session. Without CRON_SECRET set it refuses everything, which is the safe
 * way round: an open endpoint here would let anybody spend our Anthropic
 * budget by calling it in a loop.
 */
/**
 * Schedulers send GET, so both are accepted and do the same thing.
 *
 * Vercel Cron, and most others, invoke a path with a GET and put the shared
 * secret in the Authorization header. The endpoint only answered POST, so the
 * schedule would have been configured, would have appeared to be running, and
 * would have returned 405 every minute in a log nobody reads. A tick that is
 * scheduled and does nothing is worse than no tick, because it looks handled.
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this refuses everything." },
      { status: 503 },
    );
  }

  const given = request.headers.get("authorization");
  if (given !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "No." }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: stalled } = await db.rpc("stalled_runs", { limit_to: 3 });
  const ids: string[] = Array.isArray(stalled)
    ? stalled.map((r: unknown) => (typeof r === "string" ? r : (r as { id: string }).id))
    : [];

  // One step each, not one run to completion. A tick that finishes one run
  // while three others wait is a tick that starves them.
  const moved = [];
  for (const id of ids) {
    const result = await step(id);
    if (result) moved.push({ id, stage: result.stage });
  }

  return NextResponse.json({ looked: ids.length, moved });
}
