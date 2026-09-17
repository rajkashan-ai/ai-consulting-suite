import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { fetchPage, type Fetched } from "./fetch";
import { pagesFrom } from "./sitemap";
import { forPrompt, matchTrade } from "@/tools/categories";
import { fetchable } from "@/tools/identity";

/**
 * Read a business's own website and work out what they are.
 *
 * This is the whole of onboarding. We ask for one thing, a web address, and
 * everything else on the confirm screen comes from here.
 *
 * The hard rule: nothing is invented. A field we cannot find on the site comes
 * back null and the screen says we could not find it. A guessed town on the
 * first screen a customer ever sees is the worst possible first impression,
 * because it is confidently wrong about the one subject they are the expert on.
 */

const MODEL = "claude-sonnet-5";

export type Detected = {
  name: string | null;
  trade: string | null;
  town: string | null;
  address: string | null;
  oneLiner: string | null;
  services: { name: string; price: string | null }[];
  /** Pages we actually read, with the date. CLAUDE.md 1.5 rule 7. */
  sources: Fetched[];
  /** Set when we could not read the site at all. Shown as it is written. */
  problem: string | null;
  usage: { input: number; output: number };
};

const SHAPE = {
  name: "business",
  description:
    "Record what this business is, using only what the pages actually say.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: ["string", "null"], description: "Trading name as written on the site." },
      trade: {
        type: ["string", "null"],
        description:
          "The id of the single closest category from the list in the instructions, " +
          "copied exactly. Null if none of them fit, which is a real answer.",
      },
      town: { type: ["string", "null"], description: "Town or city they work in." },
      address: {
        type: ["string", "null"],
        description:
          "The address exactly as printed, postcode included, for example " +
          "'37 Smithfield Road, Shrewsbury SY1 1PW'. The postcode is how we work out " +
          "which competitors are actually near them, so a truncated one is worse than " +
          "none. Null if the site does not print an address.",
      },
      one_liner: {
        type: ["string", "null"],
        description:
          "One plain sentence on what they do and who for. Their own words where possible. No marketing language.",
      },
      services: {
        type: "array",
        description: "Named services with prices where the site publishes them.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: ["string", "null"], description: "As written, eg '£15'." },
          },
          required: ["name", "price"],
        },
      },
    },
    required: ["name", "trade", "town", "one_liner", "services"],
  },
};

const RULES = `You are reading a small business's own website to record what they are.

Use only what the pages say. If a page does not say the town, the town is null.
Never infer a trade from the business name alone: "The Fade Inn" is not evidence
of a barber, a page listing haircuts is. Never infer a price from a competitor,
a typical rate, or a range you think is normal.

Null is a correct answer and always better than a plausible one. The person
reading this screen owns the business. They will spot an invented detail
immediately, and it costs more trust than a blank does.

Prices only where the site prints them, copied as written.

For the category, use one of these ids exactly, or null. Null is correct when
none of them fit: the customer will be shown the list and can choose. Guessing
"other" would be worse than null, because everything unrecognised would then
share one useless playbook.

${forPrompt()}`;

export async function detectBusiness(website: string): Promise<Detected> {
  const empty: Detected = {
    name: null, trade: null, town: null, address: null, oneLiner: null,
    services: [], sources: [], problem: null, usage: { input: 0, output: 0 },
  };

  const home = await fetchPage(website);
  if (!home.ok) return { ...empty, sources: [home], problem: home.note };

  /**
   * Which other pages to read.
   *
   * The sitemap first, because a site listing its own pages beats guessing at
   * them. The Barber Shop Shrewsbury publishes a full price list at
   * /price-menu, and the guesses were /prices, /pricing and /services, so every
   * one missed and the sign-up recorded no prices at all.
   *
   * The guesses stay as a fallback for the sites with no sitemap.
   */
  /**
   * Guarded, because this is the first thing that touches whatever somebody
   * typed into the form. `new URL()` throws on "example.co.uk", and five runs
   * died on exactly that elsewhere on 2026-09-17.
   */
  const origin = fetchable(home.url) ? new URL(fetchable(home.url)!).origin : "";
  if (!origin) return { pages: [], read: [] } as never;
  const fromSitemap = await pagesFrom(origin, async (u) => {
    const got = await fetchPage(u);
    return { ok: got.ok, text: got.text };
  });

  const toRead = fromSitemap.length ? fromSitemap : guessedLinks(home);
  const extras = await Promise.all(toRead.map((href) => fetchPage(href)));

  const readable = extras.filter((p) => p.ok && p.text.length > 200);
  const pages = [home, ...readable];

  // Pages we tried and could not read are recorded too. A page that refused us
  // is a fact about the research, and dropping it silently is how a thin result
  // looks like a thorough one.
  const tried = [home, ...extras];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: RULES,
    tools: [SHAPE],
    tool_choice: { type: "tool", name: "business" },
    messages: [
      {
        role: "user",
        content: pages
          .map((p) => `## ${p.url}\nread ${p.fetchedAt}\n\n${p.text.slice(0, 14_000)}`)
          .join("\n\n---\n\n"),
      },
    ],
  });

  const block = response.content.find((c) => c.type === "tool_use");
  const out = (block && "input" in block ? block.input : {}) as Record<string, unknown>;

  return {
    name: str(out.name),
    // Only ever an id from the list. A word the model made up is dropped,
    // because a made-up trade is a playbook nobody else will ever share.
    trade: matchTrade(str(out.trade)),
    town: str(out.town),
    /**
     * The address is kept as printed, postcode included.
     *
     * It was being stripped to the district, on the reasoning that a full
     * postcode locates a household and for a sole trader that is their home.
     * That is true and it made distance impossible to measure, which left the
     * heaviest ranking factor doing nothing.
     *
     * The change is narrow and worth stating. This is the address the business
     * publishes on its own website to be found by. It is never shown on a
     * competitor's card, it is never sent anywhere except the postcode lookup,
     * and it goes when the account goes. DATA.md says all of this.
     */
    address: str(out.address),
    oneLiner: str(out.one_liner),
    services: Array.isArray(out.services)
      ? (out.services as { name: string; price: string | null }[]).slice(0, 12)
      : [],
    sources: tried,
    problem: null,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Guesses, for a site with no sitemap. Same site only: we are reading their
 *  business, not the web. */
function guessedLinks(home: Fetched): string[] {
  const wanted = /price|pricing|service|treatment|menu|rate|about|contact|find/i;
  const found = new Set<string>();
  const usable = fetchable(home.url);
  if (!usable) return [];
  const base = new URL(usable);

  for (const m of home.text.matchAll(/\bhttps?:\/\/\S+/g)) {
    try {
      const u = new URL(m[0]);
      if (u.hostname === base.hostname && wanted.test(u.pathname)) found.add(u.href);
    } catch {
      /* not a URL after all */
    }
  }

  // Ordinary site paths, which is how most small sites are built.
  for (const path of ["/prices", "/pricing", "/services", "/about", "/contact"]) {
    if (found.size >= 3) break;
    try {
      found.add(new URL(path, base.origin).href);
    } catch {
      // A link on their page that is not a path. Expected: pages carry broken
      // hrefs, and skipping one is right. ERROR-HANDLING.md rule 1, case four.
    }
  }

  return [...found].slice(0, 3);
}
