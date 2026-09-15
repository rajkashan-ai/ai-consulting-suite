"use server";

import { notFound } from "next/navigation";
import { detectBusiness } from "@/lib/research/detect";
import { assertNoContactDetails } from "@/lib/privacy/redact";

export type TryState =
  | { stage: "start"; error?: string }
  | {
      stage: "found";
      website: string;
      name: string | null;
      trade: string | null;
      town: string | null;
      oneLiner: string | null;
      services: { name: string; price: string | null }[];
      pages: { url: string; ok: boolean; note: string; chars: number }[];
      tokens: { input: number; output: number };
      seconds: number;
    };

/**
 * The reading step, with no sign-in and no database.
 *
 * Refused outside development. It spends real Anthropic money on whatever URL
 * it is handed, so on a public deployment it would be a bill anybody could run
 * up. The check is here on the server, not only on the page, because a page
 * that hides a button is not a page that refuses.
 */
export async function tryRead(
  _previous: TryState,
  form: FormData,
): Promise<TryState> {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) notFound();

  const website = String(form.get("website") ?? "").trim();
  if (!website) return { stage: "start", error: "Put a web address in first." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      stage: "start",
      error:
        "No Anthropic key yet. Put ANTHROPIC_API_KEY in .env.local and restart. Nothing else is needed for this page.",
    };
  }

  const began = Date.now();
  let found;
  try {
    found = await detectBusiness(website);
  } catch (e) {
    return { stage: "start", error: e instanceof Error ? e.message : String(e) };
  }

  if (found.problem) return { stage: "start", error: found.problem };

  // The same gate the real product uses, so this page cannot pass something the
  // product would have refused.
  try {
    assertNoContactDetails(
      { name: found.name, town: found.town, oneLiner: found.oneLiner },
      "what we read from a website",
    );
  } catch (e) {
    return { stage: "start", error: e instanceof Error ? e.message : String(e) };
  }

  return {
    stage: "found",
    website,
    name: found.name,
    trade: found.trade,
    town: found.town,
    oneLiner: found.oneLiner,
    services: found.services,
    pages: found.sources.map((s) => ({
      url: s.url,
      ok: s.ok,
      note: s.note,
      chars: s.text.length,
    })),
    tokens: found.usage,
    seconds: Math.round((Date.now() - began) / 100) / 10,
  };
}
