"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { POST_RULES } from "@/tools/content-social-planner/prompts";
import { cite, citeRules, type Page } from "@/tools/content-social-planner/sources";
import { knownFacts, priceRules, type ReadPage } from "@/tools/content-social-planner/stages";
import { unsafe } from "@/tools/content-social-planner/scrub";
import {
  asThought,
  intentAsks,
  isIntent,
  wrongWithRequest,
  type Intent,
  type Path,
} from "@/tools/content-social-planner/paths";
import type { Business } from "@/tools/types";

/**
 * Write one post, on the day, because somebody asked for it.
 *
 * The month plan stays and prompts the idea; this is the asking. Two ways in:
 * a category when the screen is blank, and a rough sentence when something has
 * just happened in the business.
 *
 * WHAT THIS REUSES RATHER THAN REBUILDS
 * The pages a run already read, the voice it already worked out, the prices
 * knownFacts already holds, the POST_RULES the monthly writer already follows,
 * and `unsafe`, the guard that refuses an invented claim. A second way of
 * writing a post that obeyed a second set of rules would be a second thing to
 * keep true, and the first one has already cost a run today.
 */
export async function makePost(
  workspaceId: string,
  path: Path,
  intent: Intent | null,
  thought: string | null,
): Promise<{ error: string | null }> {
  const wrong = wrongWithRequest(path, intent, thought);
  if (wrong) return { error: wrong };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in and try again." };

  /**
   * Read through their own session, never the admin client, so row level
   * security decides what they can see. A workspace belonging to somebody else
   * comes back as nothing, which is the same answer as one that does not
   * exist, and that is the right answer: it does not say which.
   */
  const { data: w, error: looking } = await supabase
    .from("workspaces")
    .select("id, name, website, trade, town, address, headline_price, services, one_liner, reach, found_via, known_competitor")
    .eq("id", workspaceId)
    .maybeSingle();

  if (looking) {
    console.error(`[make] could not read workspace ${workspaceId}: ${looking.message}`);
    return { error: "We could not reach your details. Try again in a moment." };
  }
  if (!w) return { error: "That business is not there any more." };

  const { data: run, error: reading } = await supabase
    .from("runs")
    .select("state")
    .eq("workspace_id", workspaceId)
    .eq("tool", "content-social-planner")
    .eq("ok", true)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reading) {
    console.error(`[make] could not read the last plan for ${workspaceId}: ${reading.message}`);
    return { error: "We could not reach your last plan. Try again in a moment." };
  }

  const state = (run?.state ?? {}) as { pages?: Page[]; read?: ReadPage[]; voice?: { words?: string } };
  const pages = state.pages ?? [];
  const read = (state.read ?? []).filter((p) => p.ok);

  /**
   * Pre-generation gate. Nothing is written from nothing.
   *
   * A post has to cite a page on their own site, and `unsafe` refuses one that
   * does not. Without pages there is no post that could pass, so the model is
   * never called: paying for an answer we already know we will refuse is the
   * waste this gate exists to stop.
   */
  if (!pages.length || !read.length) {
    return {
      error: "We have not read your website yet. Run the planner once and then come back.",
    };
  }

  const business: Business = {
    id: w.id,
    website: w.website ?? "",
    name: w.name,
    trade: w.trade,
    town: w.town,
    address: w.address,
    headlinePrice: w.headline_price,
    services: w.services ?? [],
    oneLiner: w.one_liner,
    reach: w.reach,
    foundVia: w.found_via ?? [],
    knownCompetitor: w.known_competitor,
  };

  const said = thought ? asThought(thought) : null;
  const theirWords = said && "text" in said ? said.text : null;

  const text = read
    .map((p) => `[${pages.findIndex((x) => x.url === p.url) + 1}] ${p.text.slice(0, 8000)}`)
    .join("\n\n");

  const asking = theirWords
    ? `SOMETHING THAT JUST HAPPENED, IN THEIR WORDS\n"${theirWords}"\n\n` +
      `Write this up as one post. Keep what they said true: you are giving it ` +
      `words, not a different story. Say which of these it turned out to be, ` +
      `and pick the one that fits rather than the one that sells hardest: ` +
      `educate, inspire, entertain, inform, connect, prove, promote, engage.\n\n`
    : `WHAT THIS POST IS FOR\n${intentAsks(intent as Intent)}\n\n` +
      `Write one post that does that, about something on their pages below.\n\n`;

  let answer: { words?: string; shot?: string; why?: string; from?: unknown; intent?: string };
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 180_000,
      maxRetries: 1,
    });

    const response = await anthropic.messages
      .stream({
        model: "claude-sonnet-5",
        max_tokens: 2_000,
        system: POST_RULES,
        messages: [
          {
            role: "user",
            content:
              `${citeRules(pages)}\n\nTHEIR PAGES\n\n${text}\n\n` +
              `HOW THEY SOUND\n${state.voice?.words ?? ""}\n\n` +
              priceRules(business) +
              asking +
              `One post, finished words ready to paste, one line saying what to ` +
              `photograph that they can do on their phone today, and one line ` +
              `saying why this post is worth putting out.`,
          },
        ],
        tools: [
          {
            name: "post",
            description: "One finished post.",
            input_schema: {
              type: "object",
              properties: {
                words: { type: "string", description: "The post, ready to paste." },
                shot: { type: "string", maxLength: 180, description: "What to photograph." },
                why: { type: "string", maxLength: 180, description: "Why this post." },
                intent: {
                  type: "string",
                  enum: ["educate", "inspire", "entertain", "inform", "connect", "prove", "promote", "engage"],
                },
                /**
                 * `from`, and it has to be that word.
                 *
                 * cite() walks what the model returns and turns a key called
                 * `from` into a `source` carrying the url and the date we read
                 * it. It looks for that one key. I asked for `source: {page}`
                 * instead, so cite walked straight past it, the post reached
                 * `unsafe` with no url behind it, and every attempt was
                 * refused with "nothing on your own site backs it up".
                 *
                 * The monthly writer has always asked for `from`. Inventing a
                 * second shape for the same idea is how the two halves of one
                 * question end up disagreeing, which is the second time today.
                 */
                from: { type: "integer", description: "The page its facts came off." },
              },
              required: ["words", "shot", "why", "intent", "from"],
            },
          } as never,
        ],
        tool_choice: { type: "tool", name: "post" },
      })
      .finalMessage();

    const used = response.content.find((c) => c.type === "tool_use" && c.name === "post");
    if (!used || !("input" in used)) {
      console.error(`[make] the model answered in prose for ${workspaceId}`);
      return { error: "We could not write that one. Try again." };
    }
    answer = used.input as typeof answer;
  } catch (e) {
    /**
     * Recorded, not swallowed. CLAUDE.md 1.4c: every catch fixes and retries,
     * tells them and continues, or tells them and stops. This one stops, and
     * the reason stays here rather than going to them.
     */
    console.error(`[make] writing failed for ${workspaceId}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return { error: "We could not reach the writer just now. Try again in a moment." };
  }

  /**
   * The page number becomes a url here, once, the same way the monthly writer
   * does it. A number the model invented expands to nothing, and an invented
   * url would not.
   */
  const written = cite(answer, pages) as { words?: string; shot?: string; why?: string; source?: { url?: string; fetchedOn?: string } };

  const post = {
    words: written.words ?? "",
    shot: written.shot ?? "",
    why: written.why ?? "",
    source: written.source ?? null,
  };

  const refused = unsafe(post as never, pages as never, knownFacts(business) as never);
  if (refused) {
    // Dropped, never reworded: a post claiming something nobody gave us is not
    // badly written, and there is no rewrite that sources it.
    return { error: `We wrote one and would not stand behind it: ${refused}. Try again.` };
  }

  const { error: saving } = await supabase.from("content_made").insert({
    workspace_id: workspaceId,
    path,
    intent: isIntent(answer.intent) ? answer.intent : (intent ?? null),
    thought: theirWords,
    words: post.words,
    shot: post.shot,
    why: post.why,
    source_url: post.source?.url ?? "",
    source_on: post.source?.fetchedOn ?? null,
  });

  if (saving) {
    console.error(`[make] could not save the post for ${workspaceId}: ${saving.message}`);
    return { error: "We wrote it and could not save it. Try again." };
  }

  revalidatePath("/workspace");
  return { error: null };
}
