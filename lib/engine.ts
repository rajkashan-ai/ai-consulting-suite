import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPage } from "@/lib/research/fetch";
import { advance, type RunState, type Stage } from "@/tools/competitor-tracker/stages";
import type { Business, ToolContext } from "@/tools/types";

/**
 * Advances one run by one step, and stops.
 *
 * Whoever calls this does not matter: the open page pokes it so it is quick
 * while somebody watches, and a scheduled tick advances it when nobody is.
 * Neither knows about the other, which is why the lease in the database exists.
 *
 * It uses the admin client on purpose. A run advanced by a scheduled tick has
 * no signed-in person behind it, so there is no session for Row Level Security
 * to check. Every row it touches is reached through the run's own id, which the
 * caller already had to know.
 */

const SMALL = "claude-sonnet-5";
const BIG = "claude-opus-5";

export type Progress = {
  stage: Stage;
  progress: string;
  documentId: string | null;
  reason: string | null;
};

export async function step(runId: string): Promise<Progress | null> {
  const db = createAdminClient();

  // Claim it. Returns nothing if it is finished, or if another tick has it.
  const { data: claimed } = await db.rpc("claim_run", { run: runId });
  const run = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!run) return null;

  const { data: workspace } = await db
    .from("workspaces")
    .select("id, website, name, trade, town, one_liner")
    .eq("id", run.workspace_id)
    .single();

  if (!workspace) return fail(db, runId, "That business is gone.");

  const business: Business = {
    id: workspace.id,
    website: workspace.website ?? "",
    name: workspace.name,
    trade: workspace.trade,
    town: workspace.town,
    oneLiner: workspace.one_liner,
  };

  const spent = { input: 0, output: 0 };
  let pages = 0;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const ctx: ToolContext = {
    read: async (url) => {
      pages += 1;
      const got = await fetchPage(url);
      return {
        ok: got.ok,
        url: got.url,
        text: got.text,
        title: got.title,
        fetchedAt: got.fetchedAt,
        note: got.note,
      };
    },

    think: async ({ system, prompt, shape, tools, hard, maxTokens }) => {
      const response = await anthropic.messages.create({
        model: hard ? BIG : SMALL,
        max_tokens: maxTokens ?? 4000,
        system,
        ...(tools?.length || shape
          ? {
              tools: [
                ...((tools ?? []) as never[]),
                ...(shape ? [shape as never] : []),
              ],
            }
          : {}),
        // Only force the shape when there is no server tool in play. Forcing it
        // alongside web search would stop the model searching before it answered.
        ...(shape && !tools?.length
          ? { tool_choice: { type: "tool" as const, name: shape.name } }
          : {}),
        messages: [{ role: "user", content: prompt }],
      });

      spent.input += response.usage.input_tokens;
      spent.output += response.usage.output_tokens;

      if (!shape) {
        const text = response.content.find((c) => c.type === "text");
        return text && "text" in text ? text.text : "";
      }

      const used = response.content.find(
        (c) => c.type === "tool_use" && c.name === shape.name,
      );
      return used && "input" in used ? used.input : {};
    },

    progress: () => {
      // Progress is written once per step, from the result below, rather than
      // every time a tool says something. A row updated twenty times a step is
      // twenty writes to say the same thing.
    },
  };

  let result;
  try {
    result = await advance(run.stage as Stage, (run.state ?? {}) as RunState, business, ctx);
  } catch (e) {
    return fail(db, runId, e instanceof Error ? e.message : String(e), spent, pages);
  }

  // A finished run becomes a document, and the document is what the screen
  // reads from then on. The run row is the machinery; the document is the work.
  let documentId: string | null = null;
  if (result.stage === "done" && result.state.card) {
    const { data: doc } = await db
      .from("documents")
      .insert({
        workspace_id: business.id,
        tool: "competitor-tracker",
        title: `Competitor Tracker, ${new Date().toLocaleDateString("en-GB")}`,
        body: result.state.card as never,
      })
      .select("id")
      .single();
    documentId = doc?.id ?? null;
  }

  await db
    .from("runs")
    .update({
      stage: result.stage,
      state: result.state as never,
      progress: result.progress,
      leased_until: null,
      pages_fetched: (run.state?.pagesFetched ?? 0) + pages,
      input_tokens: spent.input,
      output_tokens: spent.output,
      ...(result.stage === "done" || result.stage === "failed"
        ? {
            finished_at: new Date().toISOString(),
            ok: result.stage === "done",
            error: result.state.reason ?? null,
            document_id: documentId,
          }
        : {}),
    })
    .eq("id", runId);

  return {
    stage: result.stage,
    progress: result.progress,
    documentId,
    reason: result.state.reason ?? null,
  };
}

async function fail(
  db: ReturnType<typeof createAdminClient>,
  runId: string,
  reason: string,
  spent = { input: 0, output: 0 },
  pages = 0,
): Promise<Progress> {
  await db
    .from("runs")
    .update({
      stage: "failed",
      progress: reason,
      error: reason,
      ok: false,
      finished_at: new Date().toISOString(),
      leased_until: null,
      pages_fetched: pages,
      input_tokens: spent.input,
      output_tokens: spent.output,
    })
    .eq("id", runId);
  return { stage: "failed", progress: reason, documentId: null, reason };
}
