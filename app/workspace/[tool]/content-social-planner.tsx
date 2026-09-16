import { createClient } from "@/lib/supabase/server";
import { decidePlan, sayNext } from "@/tools/content-social-planner/freshness";
import { FIRST_STAGE } from "@/tools/content-social-planner/index";
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
export default async function ContentSocialPlanner({
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
  ]);

  const latest = runs?.[0];

  if (latest && latest.stage !== "done" && latest.stage !== "failed") {
    return <Running runId={latest.id} startedAt={latest.started_at} />;
  }

  const decision = decidePlan(document?.created_at ?? null, new Date());

  if (document && !decision.allowed) {
    return <PlanView plan={document.body as never} nextPlan={sayNext(decision)} />;
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
    .insert({ workspace_id: workspaceId, tool: "content-social-planner", stage: FIRST_STAGE })
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
        <Running runId={started.id} startedAt={started.started_at} />
      </>
    );
  }

  return <Running runId={started.id} startedAt={started.started_at} />;
}
