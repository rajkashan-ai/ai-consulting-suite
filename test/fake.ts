import type { Business, ToolContext } from "../tools/types.ts";

/**
 * A stand-in for the web and the model, so the pipeline can be tested.
 *
 * Every stage already takes its context as an argument, which is what makes
 * this possible. That was not an accident: a tool that cannot reach the web
 * except through something handed to it is also a tool that can be run without
 * the web.
 *
 * The pages it serves were captured from a real run on 15 September, not
 * written by me. A fixture I invent tests my idea of what Booksy returns, which
 * is the thing most likely to be wrong.
 */

export type Recorded = {
  searchResults: { term: string; results: { url: string; title: string }[] }[];
  listing: { url: string; fetchedOn: string; text: string };
  competitorPage: { name: string; url: string; text: string };
  ownPage: { url: string; text: string };
  listed: { name: string; reviews: number | null; rating: number | null;
    reviewedDaysAgo: number | null; area: string | null; price: number | null; url: string | null }[];
};

export type Calls = {
  read: string[];
  think: { system: string; prompt: string; shape?: string }[];
  search: string[][];
};

export function fakeContext(
  recorded: Recorded,
  answers: {
    /** What the model returns, by the name of the shape it was asked for. */
    think?: Record<string, unknown>;
    /** Pages that should come back as a refusal rather than content. */
    refuse?: string[];
  } = {},
): { ctx: ToolContext; calls: Calls } {
  const calls: Calls = { read: [], think: [], search: [] };

  const ctx: ToolContext = {
    read: async (url) => {
      calls.read.push(url);
      const at = new Date().toISOString();

      if (answers.refuse?.some((r) => url.includes(r))) {
        return { ok: false, url, text: "", title: null, fetchedAt: at,
          note: "Their robots.txt asks us not to read this page." };
      }
      if (url.includes("/s/") || url.includes("/lp/")) {
        return { ok: true, url, text: recorded.listing.text, title: "Barbers in Shrewsbury",
          fetchedAt: at, note: "" };
      }
      if (url.includes("shrewsburybarber")) {
        return { ok: true, url, text: recorded.ownPage.text, title: "The Barber Shop",
          fetchedAt: at, note: "" };
      }
      return { ok: true, url, text: recorded.competitorPage.text, title: "A barber",
        fetchedAt: at, note: "" };
    },

    think: async ({ system, prompt, shape }) => {
      calls.think.push({ system, prompt, shape: shape?.name });
      const given = shape?.name ? answers.think?.[shape.name] : undefined;
      if (given !== undefined) return given;

      // Sensible defaults, so a test only has to say what it cares about.
      if (shape?.name === "businesses") {
        return { businesses: recorded.listed };
      }
      if (shape?.name === "battlecard") {
        return { competitors: [], where_you_win: [], where_they_win: [], actions: [] };
      }
      return {};
    },

    search: async (terms) => {
      calls.search.push(terms);
      return recorded.searchResults;
    },

    progress: () => {},
  };

  return { ctx, calls };
}

export const aBusiness = (p: Partial<Business> = {}): Business => ({
  id: "w1",
  website: "https://www.shrewsburybarber.co.uk",
  name: "The Barber Shop Shrewsbury",
  trade: "barber",
  town: "Shrewsbury",
  address: "37 Smithfield Road, Shrewsbury SY1 1PW",
  headlinePrice: 8,
  oneLiner: null,
  reach: "nearby",
  foundVia: ["booking"],
  knownCompetitor: null,
  ...p,
});
