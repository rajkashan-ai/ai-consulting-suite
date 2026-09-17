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
  /** What the model says when asked who competes. Absent means it named
   *  nobody, which is the case that falls back to the crawler. */
  competitors?: { competitors: { name: string; why: string }[] };
  /** A grid and a narrative shaped the way the model returns them, so a test
   *  that does not care about them still exercises a complete card. */
  grid: unknown[];
  battlecard: Record<string, unknown>;
};

export type Calls = {
  read: string[];
  think: {
    system: string;
    prompt: string;
    /** The shared, cached part of the user message, if the call sent one. */
    cachedPrefix?: string;
    /** Everything the model was sent as the user message, cached part first.
     *  What a test about prompt content or size should look at: which half a
     *  sentence sits in is a caching decision, not a change in what was asked. */
    asked: string;
    shape?: string;
    /** The whole schema, so a test can assert what the model was asked for. */
    shapeFull?: unknown;
    /** Whether this call was allowed to search before it answered. */
    searched?: boolean;
  }[];
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

    /**
     * A shape nobody gave an answer for is a test that is not testing anything.
     *
     * This used to fall through to `return {}` for any shape it did not
     * recognise. When the comparison grid was added, every test carried on
     * passing while the grid came back empty, which is exactly the bug that
     * then cost a live run of 196,000 tokens and ten minutes.
     *
     * A permissive fake hides the thing it exists to catch. It throws now, so
     * adding a stage to the pipeline breaks the tests until somebody says what
     * that stage should return.
     */
    think: async ({ system, prompt, cachedPrefix, shape, tools }) => {
      calls.think.push({
        system,
        prompt,
        cachedPrefix,
        asked: `${cachedPrefix ?? ""}${prompt}`,
        shape: shape?.name,
        shapeFull: shape,
        searched: Boolean(tools?.length),
      });

      const given = shape?.name ? answers.think?.[shape.name] : undefined;
      if (given !== undefined) return given;

      if (shape?.name === "businesses") return { businesses: recorded.listed };

      /**
       * The grid is asked for one area at a time, four calls at once.
       *
       * Answering all four with the whole recorded grid made every test pass
       * while the split was never exercised: four identical areas came back and
       * the pipeline relabelled them, so a grid that only ever produced pricing
       * looked like a full card. The fake has to answer the question it was
       * actually asked, or it is testing itself.
       */
      if (shape?.name === "comparison") {
        /**
         * Which area was asked for, read from the prompt.
         *
         * This used to read it out of the tool schema's `area` enum, because
         * that was where the product pinned it. The schema is now the same for
         * every area on purpose: tools sit at the front of what can be cached,
         * so a schema that differed per area meant the shared evidence prefix
         * could never be reused, and both calls paid to write it.
         *
         * The prompt is where the area is named now, so that is where the fake
         * has to look. Reading the old place silently returned pricing rows for
         * every call, which is the fake answering a question nobody asked.
         */
        const asked = /ONE area only:\s*([a-z]+)/i.exec(prompt)?.[1];

        const all = (recorded.grid ?? []) as { area?: string }[];
        if (!asked) return { comparison: all };
        return { comparison: all.filter((g) => g.area === asked) };
      }
      /**
       * Who competes, asked with the search tool and answered as text.
       *
       * No shape, because the engine cannot force one alongside a server tool.
       * So the reply is a list, one name per line, and `namesFrom` reads it.
       * The fake answers in the same shape the real call does, decoration and
       * all, or it would only prove that a clean list parses.
       */
      if (!shape && tools?.length) {
        const names = recorded.competitors?.competitors ?? [];
        if (!names.length) return "";
        return (
          "Here are the closest ones I found:\n\n" +
          names.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
        );
      }

      /**
       * Who competes, asked rather than crawled.
       *
       * Empty by default on purpose. Every test written before this stage
       * existed starts at the front door and should carry on exercising the
       * crawler behind it, which is still real behaviour and still runs when
       * asking comes up short. A test about asking supplies its own names.
       */
      if (shape?.name === "competitors") {
        return recorded.competitors ?? { competitors: [] };
      }

      if (shape?.name === "battlecard") return recorded.battlecard;

      throw new Error(
        `No answer was given for the shape "${shape?.name ?? "(none)"}". ` +
          `Add one to fakeContext, or a test will pass while that step returns nothing.`,
      );
    },

    search: async (terms) => {
      calls.search.push(terms);

      /**
       * A term asking about one named business gets results about that
       * business.
       *
       * The recorded sets are answers to three broad searches, returned in
       * order. That is right for the crawler, which asks three broad things,
       * and wrong for name checking, which asks one question per name: the
       * second name was being checked against the answer to the first, so a
       * business that plainly exists came back unproved. The fake was deciding
       * the outcome, not the code.
       *
       * A quoted phrase means "is this business real", so answer that.
       */
      const everything = recorded.searchResults.flatMap((s) => s.results);

      return terms.map((term, i) => {
        const quoted = term.match(/"([^"]+)"/)?.[1];
        if (!quoted) return recorded.searchResults[i] ?? { term, results: [] };

        const want = quoted.toLowerCase();
        return {
          term,
          results: everything.filter((r) => (r.title ?? "").toLowerCase().includes(want)),
        };
      });
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
  services: [{ name: "Classic cut", price: "£15" }],
  oneLiner: null,
  reach: "nearby",
  foundVia: ["booking"],
  knownCompetitor: null,
  ...p,
});

/**
 * Answer the picker, the way an owner who agrees with us would.
 *
 * The run now stops at "picking" and waits for a person to say who they
 * compete with. Every test that drives a run to the end has to answer it, or
 * it is testing a parked run.
 *
 * Agreeing is the common path and the boring one, so it is the default here.
 * The paths that matter more have their own tests in picker.test.ts: an owner
 * who chooses differently, one who chooses too few, one who never answers, and
 * a browser sending a name that was never offered.
 *
 * Returns the state unchanged for every other stage, so a loop can call it on
 * every step without asking what stage it is in.
 */
export function ownerAgrees<S extends { stage: string; state: Record<string, unknown> }>(
  step: S,
): S["state"] {
  if (step.stage !== "picking") return step.state;
  const offered = (step.state.offered ?? []) as { name: string; ours?: boolean }[];
  const ours = offered.filter((o) => o.ours).map((o) => o.name);
  // If we proposed nobody, take the top of the list rather than none: a test
  // that silently answers with an empty choice parks for ever.
  return { ...step.state, chosen: ours.length ? ours : offered.slice(0, 5).map((o) => o.name) };
}
