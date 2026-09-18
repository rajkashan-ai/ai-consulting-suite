import { createClient } from "@/lib/supabase/server";
import { decidePlan } from "@/tools/content-social-planner/freshness";
import { FIRST_STAGE, lastPlan } from "@/tools/content-social-planner/index";
import Channels from "./channels";
import PlanView from "./plan";
import { isStyle } from "@/tools/content-social-planner/persona";
import Running from "./running";
import { tooOldToResume } from "@/tools/cadence";

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

  let latest = runs?.[0];

  /**
   * A run from yesterday is not a run to carry on with. See RESUMABLE_HOURS.
   *
   * The same hole as the Competitor Tracker had, and it cost that one a screen
   * full of New York businesses: a run parked overnight was resumed, so rows
   * gathered before a fix arrived as findings after it. Retired rather than
   * ignored, because one run at a time per workspace is a database constraint.
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
      .eq("tool", "content-social-planner")
      // Still where we found it. The scheduled tick runs every minute and may
      // have moved it on between our read and this write, and retiring a run
      // that is working is worse than resuming one that is stale.
      .eq("stage", latest.stage);

    if (retiring) {
      console.error(`[planner] could not retire the stale run ${latest.id}: ${retiring.message}`);
      return (
        <div className="panel" key="stuck">
          <h2 className="t-sub">We could not start this.</h2>
          <p className="t-doc">
            An earlier plan was left part way through and we could not clear it.
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
   * run finished, the page re-rendered and React treated the finished plan as
   * the same element as the live progress panel: the progress panel has hooks
   * and the plan has none, so React threw "Rendered fewer hooks than expected"
   * onto the customer's screen. It happened for real on the Tracker on
   * 2026-09-16, and this screen was copied from it.
   *
   * A crash here is worse than it looks: the progress panel is what drives the
   * run, one step per request, so crashing it stops the run, and reloading
   * starts a brand new one from zero.
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

  const decision = decidePlan(document?.created_at ?? null, new Date());

  if (document && !decision.allowed) {
    /**
     * What the owner has already done, read beside the plan rather than stored
     * inside it. A document is what we produced; this is what they did with it,
     * and the two have different lifetimes: the plan is remade every thirty
     * days and the fact that they posted on the 17th outlives it.
     */
    const [{ data: state }, { data: voice }, { data: made }] = await Promise.all([
      supabase
        .from("content_post_state")
        .select("post_date, channel, edited_words, posted_at, posted_url")
        .eq("workspace_id", workspaceId),
      supabase
        .from("content_voice_note")
        .select("persona, style, samples, inspiration")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      /**
       * Posts they asked for on the day, newest first.
       *
       * Read here beside the plan for the same reason the post state is: the
       * plan is what we produced and these are what they made, and the two
       * have different lifetimes. The plan is remade every thirty days; a post
       * they wrote on a Tuesday because a bride came in at six outlives it.
       */
      supabase
        .from("content_made")
        .select("id, path, intent, thought, words, shot, why, source_url, source_on, made_at")
        .eq("workspace_id", workspaceId)
        .order("made_at", { ascending: false })
        .limit(30),
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
        workspaceId={workspaceId}
        postState={postState}
        made={(made ?? []) as never}
        voice={{
          persona: (voice?.persona ?? null) as never,
          style: (isStyle(voice?.style) ? voice.style : "original") as never,
          samples: (voice?.samples ?? []) as string[],
          inspiration: (voice?.inspiration ?? null) as string | null,
        }}
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
          <Channels workspaceId={workspaceId} detected={null} confirmed={null} />
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
  const { data: persona } = await supabase
    .from("content_voice_note")
    .select("persona, style")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { data: started, error } = await supabase
    .from("runs")
    .insert({
      workspace_id: workspaceId,
      tool: "content-social-planner",
      stage: FIRST_STAGE,
      /* Carried on the run rather than read off Business, because the engine
         builds Business and lib/engine.ts is read-only to a tool. */
      /**
       * What they told us, and what we already suggested them.
       *
       * Both carried on the run rather than read inside it: the engine builds
       * `Business` and `lib/engine.ts` is read-only to a tool, and the `Db`
       * type a tool is handed cannot express "this tool's newest document".
       * The screen holds both already.
       */
      state: {
        told: confirmed ?? [],
        before: lastPlan(document?.body),
        /* And the voice they chose, carried the same way and for the same
           reason. A run that read its own voice would use the one it found on
           the day, and the point of Brand Persona is that they can change how
           they sound without waiting for the next run. */
        persona: (persona?.persona ?? null) as never,
        style: (persona?.style ?? "original") as never,
      },
    })
    .select("id, started_at")
    .single();

  if (error || !started) {
    return (
      <div className="panel" key="already">
        <h2 className="t-sub">Already writing.</h2>
        <p className="t-doc">Give it a moment and refresh.</p>
      </div>
    );
  }

  if (latest?.stage === "failed") {
    /**
     * That last attempt did not finish, said plainly and quietly.
     *
     * This printed the run's own error onto the page in the red used for
     * something going wrong now. The text is written for us, and a salon owner
     * can do nothing with it; and a live, healthy run was framed in alarm
     * colours because of something that happened before it started. The real
     * reason stays on the run, where we can read it.
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
