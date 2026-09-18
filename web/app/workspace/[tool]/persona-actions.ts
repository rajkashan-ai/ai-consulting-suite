"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { VOICE_RULES } from "@/tools/content-social-planner/prompts";
import { fetchPage } from "@/lib/research/fetch";
import type { ReadPage } from "@/tools/content-social-planner/stages";
import {
  SAMPLES_MAX,
  STYLE_RULES,
  asInspiration,
  asSamples,
  isStyle,
  type Persona,
  type StyleId,
} from "@/tools/content-social-planner/persona";

const MODEL = "claude-sonnet-5";

/** One model call, asking for a shape. Thrown errors are the caller's to say. */
async function ask(system: string, prompt: string, shape: Record<string, unknown>) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 180_000,
    maxRetries: 1,
  });
  const response = await anthropic.messages
    .stream({
      model: MODEL,
      max_tokens: 1_500,
      system,
      messages: [{ role: "user", content: prompt }],
      tools: [shape as never],
      tool_choice: { type: "tool", name: shape.name as string },
    })
    .finalMessage();

  const used = response.content.find((c) => c.type === "tool_use" && c.name === shape.name);
  return used && "input" in used ? (used.input as Record<string, unknown>) : null;
}

/**
 * Work out how they sound, from their site and from posts they pasted.
 *
 * Their posts first where there are any. A website is often written by whoever
 * built it; their captions are how they actually talk, which is the whole
 * reason the paste box exists. Instagram and Facebook disallow us in
 * robots.txt, so a handle cannot be read and pasting is not a way around that:
 * it is the owner handing us their own writing.
 */
export async function readPersona(
  workspaceId: string,
  rawSamples: unknown,
  rawInspiration: unknown,
): Promise<{ error: string | null }> {
  const samples = asSamples(rawSamples);

  const inspiration = asInspiration(rawInspiration);
  if (inspiration && "error" in inspiration) return { error: inspiration.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in and try again." };

  const { data: w, error: looking } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (looking) {
    console.error(`[persona] could not read workspace ${workspaceId}: ${looking.message}`);
    return { error: "We could not reach your details. Try again in a moment." };
  }
  if (!w) return { error: "That business is not there any more." };

  const { data: run } = await supabase
    .from("runs")
    .select("state")
    .eq("workspace_id", workspaceId)
    .eq("tool", "content-social-planner")
    .eq("ok", true)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const read = (((run?.state ?? {}) as { read?: ReadPage[] }).read ?? []).filter((p) => p.ok);

  /**
   * One page from the writing they admire, if they gave one.
   *
   * Through the same reader as everything else, which obeys robots, sends no
   * cookies and waits its turn. A page that refuses us is not a failure worth
   * stopping for: we say so and carry on with their own words.
   */
  let admired = "";
  let couldNotRead: string | null = null;
  if (inspiration) {
    const got = await fetchPage(inspiration.url);
    if (got.ok && got.text.trim().length > 200) {
      admired = got.text.slice(0, 6_000);
    } else {
      couldNotRead = got.note || "We could not open that one.";
    }
  }

  /**
   * Nothing is written from nothing.
   *
   * Their pasted posts, or pages a run has read. Without either there is no
   * sample of how they sound, and a persona invented from a business name is
   * the confident guess this whole product exists to avoid.
   */
  if (!samples.length && !read.length) {
    return {
      error: "Paste a post or two of yours, or run the planner once so we can read your site.",
    };
  }

  const theirs = samples.length
    ? `POSTS THEY WROTE THEMSELVES\n\n${samples.map((s, i) => `${i + 1}. ${s}`).join("\n\n")}\n\n`
    : "";
  const site = read.length
    ? `THEIR WEBSITE\n\n${read.map((p) => p.text.slice(0, 4_000)).join("\n\n")}\n\n`
    : "";
  const liked = admired ? `WRITING THEY ADMIRE, FOR CONTRAST ONLY\n\n${admired}\n\n` : "";

  let got: Record<string, unknown> | null;
  try {
    got = await ask(
      VOICE_RULES,
      `${theirs}${site}${liked}` +
        (samples.length && read.length
          ? `Their own posts are the truer sample: a website is often written by somebody else. ` +
            `Where the two disagree, follow the posts.\n\n`
          : "") +
        (admired
          ? `The admired writing is what they would like to sound more like. Say what it does that ` +
            `theirs does not, in the avoid and style fields. Never copy its words.\n\n`
          : "") +
        `Describe how ${w.name ?? "this business"} writes, so somebody could match it.`,
      {
        name: "persona",
        description: "How this business writes, in parts they can disagree with.",
        input_schema: {
          type: "object",
          properties: {
            tone: { type: "string", maxLength: 120, description: "How they come across, one line." },
            uses: {
              type: "array",
              maxItems: 8,
              items: { type: "string", maxLength: 30 },
              description: "Everyday words they actually use, taken from their own text.",
            },
            avoids: {
              type: "array",
              maxItems: 8,
              items: { type: "string", maxLength: 30 },
              description: "Words they never reach for. As much of a fingerprint as the ones they do.",
            },
            style: {
              type: "string",
              maxLength: 160,
              description: "Sentence length, line breaks, whether they say you and we.",
            },
          },
          required: ["tone", "uses", "avoids", "style"],
        },
      },
    );
  } catch (e) {
    console.error(`[persona] reading failed for ${workspaceId}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return { error: "We could not work that out just now. Try again in a moment." };
  }

  if (!got) {
    console.error(`[persona] the model answered in prose for ${workspaceId}`);
    return { error: "We could not work that out just now. Try again." };
  }

  const persona: Persona = {
    tone: String(got.tone ?? ""),
    uses: Array.isArray(got.uses) ? got.uses.map(String).slice(0, 8) : [],
    avoids: Array.isArray(got.avoids) ? got.avoids.map(String).slice(0, 8) : [],
    style: String(got.style ?? ""),
    chosen: "original",
  };

  const { error: saving } = await supabase.from("content_voice_note").upsert(
    {
      workspace_id: workspaceId,
      samples: samples.slice(0, SAMPLES_MAX),
      inspiration: inspiration?.url ?? null,
      persona,
      style: "original",
      persona_at: new Date().toISOString(),
      read_off: persona.tone,
    },
    { onConflict: "workspace_id" },
  );

  if (saving) {
    console.error(`[persona] could not save for ${workspaceId}: ${saving.message}`);
    return { error: "We worked it out and could not save it. Try again." };
  }

  revalidatePath("/workspace");
  // Said last, so a page we could not open does not look like a failure: the
  // persona was read from their own words either way.
  return { error: couldNotRead ? `Done, though we could not read the page you admire. ${couldNotRead}` : null };
}

/**
 * Show them one of their own posts in another voice, before anything changes.
 *
 * A preview, not a save. Choosing is a separate press, and their own voice is
 * always one click away, which is why `original` is the first option rather
 * than a sixth style.
 */
export async function previewStyle(
  workspaceId: string,
  style: StyleId,
): Promise<{ error: string | null; before?: string; after?: string }> {
  if (!isStyle(style)) return { error: "Choose one of the voices." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in and try again." };

  const { data: note } = await supabase
    .from("content_voice_note")
    .select("samples, persona")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const sample = (note?.samples ?? [])[0] as string | undefined;
  if (!sample) {
    return { error: "Paste one of your posts first, so there is something to show you." };
  }
  if (style === "original") return { error: null, before: sample, after: sample };

  try {
    const got = await ask(
      VOICE_RULES,
      `THEIR POST, AS THEY WROTE IT\n\n${sample}\n\n` +
        `Write the same post in this voice instead:\n${STYLE_RULES[style]}\n\n` +
        `Same facts, same offer, same length give or take. Nothing added that is not already there: ` +
        `no price, no claim, no detail they did not write. You are changing how it sounds, not what it says.`,
      {
        name: "rewritten",
        description: "The same post in another voice.",
        input_schema: {
          type: "object",
          properties: { words: { type: "string", maxLength: 1_400 } },
          required: ["words"],
        },
      },
    );
    if (!got?.words) {
      console.error(`[persona] no preview came back for ${workspaceId}`);
      return { error: "We could not show you that one. Try another." };
    }
    return { error: null, before: sample, after: String(got.words) };
  } catch (e) {
    console.error(`[persona] preview failed for ${workspaceId}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return { error: "We could not reach the writer just now. Try again in a moment." };
  }
}

/** Lock in the voice they chose. Everything written from now on follows it. */
export async function chooseStyle(
  workspaceId: string,
  style: StyleId,
): Promise<{ error: string | null }> {
  if (!isStyle(style)) return { error: "Choose one of the voices." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in and try again." };

  const { data: note } = await supabase
    .from("content_voice_note")
    .select("persona")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const persona = (note?.persona ?? null) as Persona | null;
  if (!persona) return { error: "We need to read your voice first." };

  const { error } = await supabase
    .from("content_voice_note")
    .update({ style, persona: { ...persona, chosen: style } })
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(`[persona] could not save the choice for ${workspaceId}: ${error.message}`);
    return { error: "We could not save that. Try again in a moment." };
  }

  revalidatePath("/workspace");
  return { error: null };
}
