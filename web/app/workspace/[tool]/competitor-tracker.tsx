import { createClient } from "@/lib/supabase/server";
import { decideRun, sayWhen, tooOldToResume } from "@/tools/cadence";
import BattlecardView from "./battlecard";
import Running from "./running";
import Picker from "./picker";
import type { Offer } from "@/tools/competitor-tracker/shortlist";

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

  const [{ data: document }, { data: runs }, { data: business }] = await Promise.all([
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
      .select("id, stage, started_at, finished_at, error, state")
      .eq("workspace_id", workspaceId)
      .eq("tool", "competitor-tracker")
      .order("started_at", { ascending: false })
      .limit(1),
    // Only for the picker's own sentence. Asked for alongside the other two
    // rather than after them, so it costs no extra wait.
    supabase.from("workspaces").select("trade, town").eq("id", workspaceId).maybeSingle(),
  ]);

  let latest = runs?.[0];

  /**
   * A run from yesterday is not a run to carry on with.
   *
   * See RESUMABLE_HOURS. Retired here rather than ignored, because one run at a
   * time per workspace is a database constraint: leaving it unfinished blocks
   * the fresh one from starting and the screen would show nothing at all.
   */
  if (latest && latest.stage !== "done" && latest.stage !== "failed"
      && tooOldToResume(latest.started_at, new Date())) {
    const { error: retiring } = await supabase
      .from("runs")
      .update({
        stage: "failed",
        ok: false,
        finished_at: new Date().toISOString(),
        error: "This one was left overnight, so we have started it again.",
      })
      .eq("id", latest.id)
      .eq("workspace_id", workspaceId)
      .eq("tool", "competitor-tracker")
      // Still where we found it. The scheduled tick runs every minute and may
      // have moved it on between our read and this write, and retiring a run
      // that is working is worse than resuming one that is stale.
      .eq("stage", latest.stage);

    if (retiring) {
      // Cannot start a fresh one while this blocks the constraint, and showing
      // yesterday's findings as today's is the fault being fixed. Say so.
      console.error(`[tracker] could not retire the stale run ${latest.id}: ${retiring.message}`);
      return (
        <div className="panel" key="stuck">
          <h2 className="t-sub">We could not start this.</h2>
          <p className="t-doc">
            An earlier check was left part way through and we could not clear it.
            Try again in a moment.
          </p>
        </div>
      );
    }
    latest = undefined;
  }

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
  /**
   * Waiting for them to say who they compete with.
   *
   * Before the running branch, because a run parked here is not running: the
   * progress panel would sit saying "Working" while nothing happened and the
   * loop asked a question whose answer cannot change until somebody clicks.
   *
   * Only `offered` crosses to the browser. A run's state also holds the text of
   * pages read off other people's websites, and none of that belongs in a page
   * source. CLAUDE.md 1.4c rule 3.
   */
  if (latest?.stage === "picking") {
    const parked = (latest.state ?? {}) as { offered?: Offer[]; chosen?: string[] };
    const offered = parked.offered ?? [];
    /**
     * Asked only while there is still a question.
     *
     * Saving their choice writes `chosen` and nothing else: the run is still
     * sitting at this stage until a step moves it on. Keying only on the stage
     * drew the picker again over the answer they had just given, and the one
     * thing that advances the run is the progress panel below, which never got
     * to mount.
     */
    if (offered.length && !parked.chosen?.length) {
      return (
        <Picker
          key="picking"
          runId={latest.id}
          offered={offered}
          trade={business?.trade ?? null}
          town={business?.town ?? null}
        />
      );
    }
    // Parked with nothing to show is our fault, not a question for them. Let
    // the progress panel run: the scheduled tick moves it on at the deadline.
  }

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
