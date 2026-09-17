import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VERDICTS = ["wrong", "weak", "useless", "missing"] as const;

/**
 * Mark one claim or action.
 *
 * Four verdicts from a list, never a text box on its own. A count of "eleven
 * people said the actions do not fit" is a decision; eleven paragraphs of prose
 * is a reading job nobody does. The note is there for the thing the list did
 * not think of.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json()) as {
    workspaceId?: string;
    documentId?: string;
    runId?: string;
    target?: string;
    said?: string;
    verdict?: string;
    note?: string;
  };

  if (!body.workspaceId || !body.target || !VERDICTS.includes(body.verdict as never)) {
    return NextResponse.json({ error: "Not a mark we understand." }, { status: 400 });
  }

  // Row Level Security decides whether this workspace is theirs. If it is not,
  // the insert returns nothing and we do not have to decide again.
  const { data, error } = await supabase
    .from("feedback")
    .insert({
      workspace_id: body.workspaceId,
      document_id: body.documentId ?? null,
      run_id: body.runId ?? null,
      target: body.target,
      said: (body.said ?? "").slice(0, 600),
      verdict: body.verdict,
      note: (body.note ?? "").slice(0, 600) || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
