import { createClient } from "@/lib/supabase/server";
import { decidePlan, sayNext } from "@/tools/content-social-planner/freshness";
import { FIRST_STAGE } from "@/tools/content-social-planner/index";
import Channels from "./channels";
import PlanView from "./plan";
import Running from "./running";

/**
 * Show the month, watch one being written, or start writing one.
 *
 * Same shape as the Tracker's panel and deliberately not the same file: the
 * queries name this tool, the freshness rule is thirty days rather than seven,
 * and a tool importing another tool's screen is the coupling `contract.ts`
 * exists to remove.
 */
const OPENING = {
  doing: "Reading your own website",
  takes: "Usually a minute or two",
  note:
    "Everything we write comes off your own pages, so we read them first: what " +
    "you sell, what it costs, and how you already write. We research nobody " +
    "else. Close this if you like and come back: it keeps going without you.",
};

export default async function ContentSocialPlanner({
  workspaceId,
  ready,
}: {
  workspaceId: string;
  ready: boolean;
}) {
  const supabase = await createClient();

  const [{ data: document }, { data: runs }, { data: workspace }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("tool", "content-social-planner")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("runs")
      .select("id, stage, started_at, finished_at, error")
      .eq("workspace_id", workspaceId)
      .eq("tool", "content-social-planner")
      .order("started_at", { ascending: false })
      .limit(1),
    supabase.from("workspaces").select("channels, website").eq("id", workspaceId).maybeSingle(),
  ]);

  const confirmed = (workspace?.channels ?? null) as string[] | null;

  const latest = runs?.[0];

  if (latest && latest.stage !== "done" && latest.stage !== "failed") {
    return <Running runId={latest.id} startedAt={latest.started_at} opening={OPENING} />;
  }

  const decision = decidePlan(document?.created_at ?? null, new Date());

  if (document && !decision.allowed) {
    /**
     * What the owner has already done, read beside the plan rather than stored
     * inside it. A document is what we produced; this is what they did with it,
     * and the two have different lifetimes: the plan is remade every thirty
     * days and the fact that they posted on the 17th outlives it.
     */
    const [{ data: state }, { data: voice }] = await Promise.all([
      supabase
        .from("content_post_state")
        .select("post_date, channel, edited_words, posted_at, posted_url")
        .eq("workspace_id", workspaceId),
      supabase
        .from("content_voice_note")
        .select("corrections")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

    const postState = Object.fromEntries(
      (state ?? []).map((r) => [
        `${r.post_date}|${r.channel}`,
        { editedWords: r.edited_words, postedAt: r.posted_at, postedUrl: r.posted_url },
      ]),
    );

    return (
      <>
      <PlanView
        plan={document.body as never}
        nextPlan={sayNext(decision)}
        workspaceId={workspaceId}
        postState={postState}
        corrections={(voice?.corrections ?? []) as string[]}
      />
      {/* Kept on the finished plan, not only before the first run. A channel
          they started last week is the most likely thing to be wrong, and a
          setting you can only change by starting over is a setting nobody
          changes. */}
      <div className="band band--a band--last">
        <div className="band__in">
          <Channels
            workspaceId={workspaceId}
            detected={(document.body as { channels?: string[] })?.channels ?? []}
            confirmed={confirmed}
          />
        </div>
      </div>
      </>
    );
  }

  /**
   * Nobody has ever been asked where they post. Ask before spending anything.
   *
   * This used to be inferred from the words in their own page copy and never
   * confirmed, so a business whose site does not name a platform got a run that
   * read their whole site, called the model twice and then stopped with
   * "we could not tell which accounts you post from".
   */
  if (ready && confirmed === null) {
    /**
     * Nothing pre-ticked, and no second fetch to work one out.
     *
     * I wrote a fetch here to read their home page and suggest the platforms it
     * mentions, with a comment explaining why this one was fine. CLAUDE.md 1.5
     * says reading the web goes through lib/research/fetch.ts, which obeys
     * robots and queues per host, and a comment arguing an exception is how a
     * rule stops being a rule. The suggestion was a nicety; asking plainly is
     * not worse, and it is the only thing here that has never been done at all.
     *
     * The run still detects from the pages it reads, which is where that
     * belongs, and this screen shows the answer back on every later visit.
     */
    return (
      <div className="band band--a band--first band--last">
        <div className="band__in">
          <Channels workspaceId={workspaceId} detected={[]} confirmed={null} />
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="panel">
        <h2 className="t-sub">We need your website first.</h2>
        <p className="t-doc">
          Everything here is written from what is already on your own pages, so
          there is nothing to write from until we have the address. Put it in on
          Your business and come back.
        </p>
      </div>
    );
  }

  /**
   * The first stage is named, not left to the column default.
   *
   * `runs.stage` defaults to 'searching', which is the Competitor Tracker's
   * first stage written into the schema. A run of this tool inserted without a
   * stage would start in a stage this tool has never heard of and stop on its
   * first tick. Changing the default would change the Tracker's behaviour, so
   * this says what it wants instead.
   */
  const { data: started, error } = await supabase
    .from("runs")
    .insert({
      workspace_id: workspaceId,
      tool: "content-social-planner",
      stage: FIRST_STAGE,
      /* Carried on the run rather than read off Business, because the engine
         builds Business and lib/engine.ts is read-only to a tool. */
      state: { told: confirmed ?? [] },
    })
    .select("id, started_at")
    .single();

  if (error || !started) {
    return (
      <div className="panel">
        <h2 className="t-sub">Already writing.</h2>
        <p className="t-doc">Give it a moment and refresh.</p>
      </div>
    );
  }

  if (latest?.stage === "failed" && latest.error) {
    return (
      <>
        <p className="auth__error t-doc-sm">Last time: {latest.error} Trying again now.</p>
        <Running runId={started.id} startedAt={started.started_at} opening={OPENING} />
      </>
    );
  }

  return <Running runId={started.id} startedAt={started.started_at} opening={OPENING} />;
}
