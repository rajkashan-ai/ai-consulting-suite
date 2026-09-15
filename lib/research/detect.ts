import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { fetchPage, type Fetched } from "./fetch";

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
          "What they do, as one lower case noun a person would use: barber, plumber, landscaper, accountant.",
      },
      town: { type: ["string", "null"], description: "Town or city they work in." },
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

Prices only where the site prints them, copied as written.`;

export async function detectBusiness(website: string): Promise<Detected> {
  const empty: Detected = {
    name: null, trade: null, town: null, oneLiner: null,
    services: [], sources: [], problem: null, usage: { input: 0, output: 0 },
  };

  const home = await fetchPage(website);
  if (!home.ok) return { ...empty, sources: [home], problem: home.note };

  // A home page often sells and says little. Prices and the town usually live
  // one click away, so we read the few pages most likely to carry them.
  const extras = await Promise.all(
    pickLinks(home).map((href) => fetchPage(href)),
  );
  const pages = [home, ...extras.filter((p) => p.ok && p.text.length > 200)];

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
    trade: str(out.trade)?.toLowerCase() ?? null,
    town: str(out.town),
    oneLiner: str(out.one_liner),
    services: Array.isArray(out.services)
      ? (out.services as { name: string; price: string | null }[]).slice(0, 12)
      : [],
    sources: pages,
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

/** Up to three same-site pages whose link text suggests prices, services or
 *  where they are. Same site only: we are reading their business, not the web. */
function pickLinks(home: Fetched): string[] {
  const wanted = /price|pricing|service|treatment|menu|rate|about|contact|find/i;
  const found = new Set<string>();
  const base = new URL(home.url);

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
    found.add(new URL(path, base.origin).href);
  }

  return [...found].slice(0, 3);
}
