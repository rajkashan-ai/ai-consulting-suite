import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Everything behind one battlecard, small enough to paste into a conversation.
 *
 * WHY IT EXISTS
 * "That claim is wrong" is not enough to act on without knowing which page it
 * came from, what that page said, which stage produced it and what the guards
 * thought. Describing all that in prose is slow and lossy, and it was being
 * done by hand.
 *
 * WHAT IS LEFT OUT, ON PURPOSE
 * The text of every page read. Seven pages at twelve thousand characters is
 * ninety thousand characters of somebody else's website, which is too big to
 * paste and is not ours to pass around. Each page is listed with its address,
 * its size and whether it could be read, which is enough to know where to look.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data: run } = await supabase
    .from("runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!run) return NextResponse.json({ error: "No such run." }, { status: 404 });

  const [{ data: workspace }, { data: document }, { data: marks }] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", run.workspace_id).single(),
    supabase
      .from("documents")
      .select("id, title, body, created_at")
      .eq("id", run.document_id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle(),
    supabase
      .from("feedback")
      .select("target, said, verdict, note, created_at")
      .eq("run_id", id)
      .order("created_at"),
  ]);

  /**
   * The run's own state, loosely typed on purpose.
   *
   * This reads whatever a run happens to hold so it can be pasted into a
   * conversation, and a run halfway through a new stage may hold a shape no
   * type yet describes. Everything is optional and everything is defaulted, so
   * a missing field reads as absent rather than throwing.
   */
  type Loose = Record<string, any>;
  const state = (run.state ?? {}) as Loose;

  const pagesRead = [
    ...(state.listingPages ?? []),
    ...(Object.values(state.pages ?? {}) as Loose[][]).flat(),
  ].map((p: Loose) => ({
    url: p.url,
    read: p.ok,
    words: p.ok ? Math.round(String(p.text ?? "").length / 5) : 0,
    why_not: p.ok ? undefined : p.note,
  }));

  return NextResponse.json(
    {
      what_this_is:
        "Everything behind one Competitor Tracker run. Page text is left out: " +
        "too big to paste and not ours to pass around. Marks are Raj's.",

      // What was marked as wrong comes first, because it is the reason this
      // was exported at all.
      marks: marks ?? [],

      business: workspace && {
        name: workspace.name,
        website: workspace.website,
        trade: workspace.trade,
        town: workspace.town,
        address: workspace.address,
        headline_price: workspace.headline_price,
        services: workspace.services,
        reach: workspace.reach,
        found_via: workspace.found_via,
        known_competitor: workspace.known_competitor,
      },

      run: {
        stage: run.stage,
        progress: run.progress,
        error: run.error,
        seconds:
          run.finished_at && run.started_at
            ? Math.round(
                (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000,
              )
            : null,
        input_tokens: run.input_tokens,
        output_tokens: run.output_tokens,
        pages_fetched: run.pages_fetched,
        repairs: state.repairs ?? 0,
        // What the guards objected to, if anything did.
        refused: state.problems ?? null,
      },

      how_it_chose: {
        searches: (state.seen ?? []).map((s: Loose) => ({
          term: s.term,
          results: (s.results ?? []).length,
        })),
        found_on_the_listing: (state.fromListings ?? []).length,
        ranked: (state.picked ?? []).map((p: Loose) => ({
          name: p.name,
          score: p.score,
          because: p.because,
          miles: p.miles ?? null,
        })),
        the_five: (state.competitors ?? []).map((c: Loose) => c.name),
      },

      pages_read: pagesRead,
      playbook_used: state.playbook ?? null,
      card: document?.body ?? null,
    },
    { headers: { "cache-control": "no-store, private" } },
  );
}
