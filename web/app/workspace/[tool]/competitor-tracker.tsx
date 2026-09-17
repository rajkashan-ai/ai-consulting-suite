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
const OPENING = {
  doing: "Looking for who you are up against",
  takes: "Usually about three minutes",
  note:
    "We find up to five competitors and read what each of them publishes about " +
    "prices, booking, reviews and opening. " +
    "Every figure comes off a page we have read, so none of it is guesswork. " +
    "Close this if you like and come back: it keeps going without you.",
};

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

  /**
   * Keys, so React swaps these rather than reconciling them.
   *
   * Every branch below returns a different component into the same slot. When a
   * run finished, `router.refresh()` re-rendered this and React treated the
   * finished card as the same element as the live progress panel: the progress
   * panel has five hooks and the card has none, and React threw "Rendered fewer
   * hooks than expected" onto the customer's screen mid-run.
   *
   * A distinct key per branch tells React these are different things, so one
   * unmounts and the other mounts with its own state. A crash here is worse
   * than it looks: it takes the loop driving the run down with it, and
   * reloading starts a brand new run from zero.
   */
  if (latest && latest.stage !== "done" && latest.stage !== "failed") {
    return (
      <Running
        key="running"
        runId={latest.id}
        startedAt={latest.started_at}
        opening={OPENING}
      />
    );
  }

  const decision = decideRun(document?.created_at ?? null, new Date());

  if (document && !decision.allowed) {
    return (
      <BattlecardView
        key="card"
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
      <div className="panel" key="not-ready">
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
      <div className="panel" key="already">
        <h2 className="t-sub">Already looking.</h2>
        <p className="t-doc">Give it a moment and refresh.</p>
      </div>
    );
  }

  if (latest?.stage === "failed") {
    /**
     * That last attempt did not finish, said plainly and quietly.
     *
     * This printed `latest.error` straight onto the page, in the red used for
     * something going wrong now. Two faults in one line. The text is ours:
     * "an action was not supported by its evidence" is a sentence about our
     * own checks, and a salon owner can do nothing with it. And a live, healthy
     * run was framed in alarm colours because of something that happened
     * before it started.
     *
     * The real reason is still on the run, where we can read it. What the
     * owner needs is that we know it did not work and are going again.
     */
    return (
      <div key="retrying">
        <p className="note t-doc-sm">Last time this did not finish. Trying again now.</p>
        <Running runId={started.id} startedAt={started.started_at} opening={OPENING} />
      </div>
    );
  }

  return <Running key="fresh" runId={started.id} startedAt={started.started_at} opening={OPENING} />;
}
