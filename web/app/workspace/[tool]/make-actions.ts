"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { POST_RULES } from "@/tools/content-social-planner/prompts";
import { cite, citeRules, tooThinToWrite, type Page } from "@/tools/content-social-planner/sources";
import { asPhoto } from "@/tools/content-social-planner/photo";
import { knownFacts, priceRules, SHOWN_CHARS, type ReadPage } from "@/tools/content-social-planner/stages";
import { unsafe } from "@/tools/content-social-planner/scrub";
import {
  asNotes,
  asThought,
  intentAsks,
  isIntent,
  wrongWithRequest,
  type Intent,
  type Path,
  withoutMarkers,
} from "@/tools/content-social-planner/paths";
import { isStyle, personaFor, type Persona } from "@/tools/content-social-planner/persona";
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
  photo: string | null = null,
  notes: string | null = null,
): Promise<{ error: string | null }> {
  const wrong = wrongWithRequest(path, intent, thought, photo);
  if (wrong) return { error: wrong };

  /**
   * The photo, split into what the API takes, before anything else is read.
   *
   * Refused here rather than deeper: a data url handed to the API whole fails
   * as a decode error a long way from the screen, and the owner would see "we
   * could not reach the writer" for a problem that is theirs to fix in one tap.
   */
  const sent = path === "asset" ? asPhoto(photo) : null;
  if (sent && "error" in sent) return { error: sent.error };

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

  /**
   * The voice they chose, not the one we read.
   *
   * Read from content_voice_note rather than from the run's state: a run is a
   * snapshot from whenever it happened, and the whole point of Brand Persona
   * is that they can change how they sound without waiting for the next one.
   * Falls back to the run's two sentences where no persona has been worked out
   * yet, so nothing that worked yesterday stops working.
   */
  const { data: note } = await supabase
    .from("content_voice_note")
    .select("persona, style")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const state = (run?.state ?? {}) as { pages?: Page[]; read?: ReadPage[]; voice?: { words?: string } };
  const persona = (note?.persona ?? null) as Persona | null;
  const voice = persona
    ? personaFor(persona, isStyle(note?.style) ? note.style : "original")
    : `HOW THEY SOUND\n${state.voice?.words ?? ""}\n\n`;
  const pages = state.pages ?? [];
  const read = (state.read ?? []).filter((p) => p.ok);

  // Pre-generation gate. Nothing is written from nothing, and the rule lives in
  // sources.ts so the next screen that writes a post cannot forget it.
  const thin = tooThinToWrite(pages, read);
  if (thin) return { error: thin };

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
    .map((p) => `[${pages.findIndex((x) => x.url === p.url) + 1}] ${p.text.slice(0, SHOWN_CHARS)}`)
    .join("\n\n");

  /**
   * What the photo is allowed to be a source for.
   *
   * The look, and nothing else. A photo carries no price and no booking line,
   * so those still come off the numbered pages and still carry `from`, which
   * is what keeps `unsafe` meaningful on this path rather than merely passed.
   *
   * And never the person. The photo is of somebody's customer, who did not
   * agree to be described in a caption. The work is the subject; whoever is
   * wearing it is not.
   */
  const wanted = asNotes(notes);

  const aboutThePhoto =
    `A PHOTO THEY JUST TOOK, ATTACHED ABOVE\n` +
    (wanted
      ? `What they want mentioned, in their words: "${wanted}"\n\n`
      : `They wrote no notes. Work from the photo and their pages.\n\n`) +
    `Describe what you can actually see of the work. That description is the ` +
    `one thing the photo is a source for, so do not stretch it: if the photo ` +
    `does not show it, do not say it.\n\n` +
    `Never describe the person. Not their face, their age, their body, their ` +
    `clothes or who they might be. The work is the subject. A customer sat in ` +
    `a chair did not agree to be written about.\n\n` +
    `Everything else, the price and how to book, comes off the pages above and ` +
    `carries "from" like any other fact. Say which of these the post turned ` +
    `out to be: educate, inspire, entertain, inform, connect, prove, promote, ` +
    `engage.\n\n` +
    (wanted
      ? `First, answer "fits": do their notes describe what is actually in this ` +
        `photo? If they do not, say false. Do not write the post around the ` +
        `notes instead of the picture, and do not attach the price of work the ` +
        `picture does not show.\n\n`
      : ``);

  const asking = sent
    ? aboutThePhoto
    : theirWords
    ? `SOMETHING THAT JUST HAPPENED, IN THEIR WORDS\n"${theirWords}"\n\n` +
      `Write this up as one post. Keep what they said true: you are giving it ` +
      `words, not a different story. Say which of these it turned out to be, ` +
      `and pick the one that fits rather than the one that sells hardest: ` +
      `educate, inspire, entertain, inform, connect, prove, promote, engage.\n\n`
    : `WHAT THIS POST IS FOR\n${intentAsks(intent as Intent)}\n\n` +
      `Write one post that does that, about something on their pages below.\n\n`;

  type Draft = { words?: string; shot?: string; why?: string; from?: unknown; intent?: string };
  let answer: Draft & { fits?: boolean; ready?: Draft };
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
            /**
             * The photo first, then the words about it.
             *
             * Anthropic's own examples put the image block before the text
             * that refers to it, and this call has a lot of text: the pages,
             * the voice and the price rules all sit in front of the question.
             * An image buried under four thousand words of price list is an
             * image the question has to reach back for.
             */
            content: [
              ...(sent
                ? [
                    {
                      type: "image" as const,
                      source: { type: "base64" as const, media_type: sent.media_type as never, data: sent.data },
                    },
                  ]
                : []),
              {
                type: "text" as const,
                text:
                  `${citeRules(pages)}\n\nTHEIR PAGES\n\n${text}\n\n` +
                  voice +
                  priceRules(business, read) +
                  asking +
                  (sent
                    ? `TWO posts, not one, and they are different jobs.\n\n` +
                      `The first uses their facts. If it needs a figure nobody has ` +
                      `given you, do not invent one and do not leave it out: write a ` +
                      `gap in square brackets saying whose it is, like [your price ` +
                      `for this] or [how long it took]. Every price you DO state must ` +
                      `be one of theirs above, exactly as written.\n\n` +
                      `The second needs nothing from them at all. No price, no ` +
                      `figure, no gap, no square brackets anywhere. It is what you ` +
                      `can see in the photograph, said well enough to be worth ` +
                      `reading, and why that is worth showing people.\n\n` +
                      `For each: finished words ready to paste, one line saying why ` +
                      `the post is worth putting out, and for the photograph line ` +
                      `say how to shoot the next one like it.`
                    : `One post, finished words ready to paste, one line saying what to ` +
                      `photograph that they can do on their phone today, and one line ` +
                      `saying why this post is worth putting out.`),
              },
            ],
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
                /**
                 * Only on the photo path, and it earns its place.
                 *
                 * Handed a photo of a desk and told it was a cut and finish,
                 * the writer described the desk accurately, said in the shot
                 * line that no haircut was visible, and then attached the cut
                 * and finish price anyway. Honest about the picture and wrong
                 * for the owner. It plainly can tell; it was never asked.
                 */
                ...(sent && wanted
                  ? {
                      fits: {
                        type: "boolean",
                        description: "Do their notes describe what is actually in this photo?",
                      },
                    }
                  : {}),
                /**
                 * The second post, on the photo path only.
                 *
                 * Raj, 2026-09-18: also write one that needs nothing from
                 * them. The first can carry gaps where a figure is theirs to
                 * supply; this one carries no figure and no gap at all, so
                 * there is always something on the screen that can go straight
                 * out. Two posts from one call and one photo, rather than two
                 * calls.
                 */
                ...(sent
                  ? {
                      ready: {
                        type: "object",
                        description:
                          "A second post that needs nothing from them: no price, no figure, " +
                          "no square brackets. What the photograph shows, and why it is worth showing.",
                        properties: {
                          words: { type: "string" },
                          shot: { type: "string", maxLength: 180 },
                          why: { type: "string", maxLength: 180 },
                          intent: {
                            type: "string",
                            enum: ["educate", "inspire", "entertain", "inform", "connect", "prove", "promote", "engage"],
                          },
                          from: { type: "integer" },
                        },
                        required: ["words", "shot", "why", "intent", "from"],
                      },
                    }
                  : {}),
              },
              required: [
                "words", "shot", "why", "intent", "from",
                ...(sent && wanted ? ["fits"] : []),
                ...(sent ? ["ready"] : []),
              ],
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
  /**
   * The photo is not of the thing they said it was.
   *
   * Refused rather than written around. A post about whatever happens to be in
   * the picture, carrying the price of work the picture does not show, is the
   * two halves disagreeing again: the photo backs one thing and the page backs
   * another, and nothing on the screen would say so.
   */
  if (sent && wanted && answer.fits === false) {
    return {
      error:
        "That photo does not look like what you described. Change the note, or " +
        "choose another photo.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  /**
   * Both posts, each judged on its own.
   *
   * One of the two failing must not take the other with it. The second exists
   * precisely so there is always something on the screen that can go straight
   * out, and throwing it away because the first cited a page wrongly would undo
   * the reason it is written.
   */
  /* After cite(): the page number has become a source carrying its url. */
  type Cited = { words?: string; shot?: string; why?: string; source?: { url?: string; fetchedOn?: string } };
  const asRow = (w: Cited, intentOf: unknown) => ({
    workspace_id: workspaceId,
    path,
    intent: isIntent(intentOf) ? intentOf : (intent ?? null),
    thought: theirWords,
    words: w.words ?? "",
    shot: w.shot ?? "",
    why: w.why ?? "",
    source_url: w.source?.url ?? "",
    source_on: w.source?.fetchedOn ?? null,
    /**
     * That a photo was behind it is ours to record, never the model's to
     * claim. We were handed one or we were not.
     */
    from_photo: Boolean(sent),
    photo_on: sent ? today : null,
    service: null,
    notes: sent && wanted ? wanted : null,
  });

  /* One strip, before the guard reads it and before it is stored, so the
     words we judged and the words they paste are the same words. */
  const clean = (w: Cited): Cited => ({ ...w, words: withoutMarkers(w.words ?? "") });

  const drafts: { written: Cited; intent: unknown }[] = [
    { written: clean(cite(answer, pages) as Cited), intent: answer.intent },
  ];
  if (sent && answer.ready) {
    drafts.push({ written: clean(cite(answer.ready, pages) as Cited), intent: answer.ready.intent });
  }

  const rows: ReturnType<typeof asRow>[] = [];
  const refusals: string[] = [];
  for (const d of drafts) {
    const post = {
      words: d.written.words ?? "",
      shot: d.written.shot ?? "",
      why: d.written.why ?? "",
      source: d.written.source ?? null,
    };
    const refused = unsafe(post as never, pages as never, knownFacts(business, read) as never);
    // Dropped, never reworded: a post claiming something nobody gave us is not
    // badly written, and there is no rewrite that sources it.
    if (refused) refusals.push(refused);
    else rows.push(asRow(d.written, d.intent));
  }

  if (!rows.length) {
    return { error: `We wrote one and would not stand behind it: ${refusals[0]}. Try again.` };
  }

  const { error: saving } = await supabase.from("content_made").insert(rows);

  if (saving) {
    console.error(`[make] could not save the post for ${workspaceId}: ${saving.message}`);
    return { error: "We wrote it and could not save it. Try again." };
  }

  revalidatePath("/workspace");
  return { error: null };
}
