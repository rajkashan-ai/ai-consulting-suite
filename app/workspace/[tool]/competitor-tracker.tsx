import { createClient } from "@/lib/supabase/server";
import { decideRun, sayWhen } from "@/tools/cadence";
import BattlecardView from "./battlecard";
import Running from "./running";

/**
 * Show the battlecard, watch one being made, or start making one.
 *
 * Opening the tool starts the research. There is no Run button, because the
 * research happens once a week and a button that does nothing six days out of
 * seven is furniture.
 *
 * The weekly rule is the agent's own decideRun, not a second copy of "is it
 * seven days" written here. Its own build notes warn about exactly that: the
 * Swap-in box reimplemented candidate.ts inline and the two copies contradicted
 * each other within hours.
 */
export default async function CompetitorTracker({
  workspaceId,
  ready,
}: {
  workspaceId: string;
  ready: boolean;
}) {
  const supabase = await createClient();

  const [{ data: document }, { data: runs }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("tool", "competitor-tracker")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("runs")
      .select("id, stage, started_at, finished_at, error")
      .eq("workspace_id", workspaceId)
      .eq("tool", "competitor-tracker")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  const latest = runs?.[0];

  if (latest && latest.stage !== "done" && latest.stage !== "failed") {
    return <Running runId={latest.id} startedAt={latest.started_at} />;
  }

  const decision = decideRun(document?.created_at ?? null, new Date());

  if (document && !decision.allowed) {
    return (
      <BattlecardView
        card={document.body as never}
        nextCheck={sayWhen(decision).replace(/^.*Next check/, "Next check")}
        workspaceId={workspaceId}
        documentId={document.id}
        runId={latest?.id ?? null}
      />
    );
  }

  if (!ready) {
    return (
      <div className="panel">
        <h2 className="t-sub">We need to know what this business does first.</h2>
        <p className="t-doc">
          Everything here turns on the trade and the town: a barber and a plumber
          need completely different places looked at. Put them in on Your
          business and come back.
        </p>
      </div>
    );
  }

  // Start one. The unique index means a second load cannot start a second,
  // so a refresh at the wrong moment costs nothing.
  const { data: started, error } = await supabase
    .from("runs")
    .insert({ workspace_id: workspaceId, tool: "competitor-tracker" })
    .select("id, started_at")
    .single();

  if (error || !started) {
    // Almost always the unique index doing its job on a double load. Say
    // something true and harmless rather than an error nobody can act on.
    return (
      <div className="panel">
        <h2 className="t-sub">Already looking.</h2>
        <p className="t-doc">Give it a moment and refresh.</p>
      </div>
    );
  }

  if (latest?.stage === "failed" && latest.error) {
    return (
      <>
        <p className="auth__error t-doc-sm">
          Last time: {latest.error} Trying again now.
        </p>
        <Running runId={started.id} startedAt={started.started_at} />
      </>
    );
  }

  return <Running runId={started.id} startedAt={started.started_at} />;
}
