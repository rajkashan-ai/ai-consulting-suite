import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { step } from "@/lib/engine";

export const maxDuration = 60;

/**
 * Advance one run by one step. Called by the page while somebody is watching.
 *
 * The engine uses the admin client, which ignores Row Level Security, so this
 * route has to prove the person owns the run before calling it. That check is
 * done with the ordinary client: if the select returns nothing, the database
 * has already decided they may not see it, and we do not have to decide again.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data: mine } = await supabase
    .from("runs")
    .select("id, stage, progress, document_id, error")
    .eq("id", id)
    .maybeSingle();

  if (!mine) return NextResponse.json({ error: "No such run." }, { status: 404 });

  if (mine.stage === "done" || mine.stage === "failed") {
    return NextResponse.json({
      stage: mine.stage,
      progress: mine.progress,
      documentId: mine.document_id,
      reason: mine.error,
    });
  }

  const moved = await step(id);

  // Null means another tick holds the lease. Not an error: say where it was and
  // let the page ask again in a moment.
  return NextResponse.json(
    moved ?? {
      stage: mine.stage,
      progress: mine.progress ?? "Working",
      documentId: null,
      reason: null,
    },
  );
}
