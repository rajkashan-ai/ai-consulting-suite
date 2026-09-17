/**
 * The join between the workspace and a tool.
 *
 * The workspace handles signing in, which business is open, reading the web
 * politely, storing what came back, and showing it. A tool handles one job.
 * Nothing else crosses this line.
 *
 * A tool never calls fetch() and never makes its own Anthropic client. Both are
 * handed to it, which is what makes CLAUDE.md 1.5 impossible to skip: there is
 * no other way to reach the web from in here.
 */

/** Everything known about the business, worked out at setup from its website. */
export type Business = {
  id: string;
  website: string;
  name: string | null;
  /** A category id from tools/categories.ts. Decides where a tool even looks. */
  trade: string | null;
  town: string | null;
  /** Street and district. Never a full postcode. Used to judge who is near. */
  address: string | null;
  /** Their cheapest published price, used to judge who sells to the same person. */
  headlinePrice: number | null;
  /** What they sell, with prices, read off their own site at sign-up. Every
   *  tool gets this: reading their website again per tool would be rude and
   *  slow, and it is the one column of a comparison we always have. */
  services: { name: string; price: string | null }[];
  oneLiner: string | null;
  /** Where their customers are: nearby, town, county, uk, world. */
  reach: string | null;
  /** Where new customers find them. Evidence for the trade's playbook. */
  foundVia: string[];
  /** One competitor they named. Kept for ever, whatever a search says. */
  knownCompetitor: string | null;
};

/**
 * What a tool hands back.
 *
 * `sections` rather than HTML, so a tool never has to know our stylesheet and
 * a design change does not mean editing six tools. Every fact carries where it
 * came from, because CLAUDE.md 1.5 rule 7 says so and because a battlecard
 * nobody can check is a battlecard nobody believes.
 */
export type ToolResult = {
  title: string;
  sections: Section[];
};

export type Section =
  | { kind: "prose"; heading?: string; text: string }
  | { kind: "list"; heading?: string; items: Item[] }
  | { kind: "table"; heading?: string; columns: string[]; rows: Cell[][]; note?: string }
  | { kind: "nothing"; heading: string; why: string };

export type Item = {
  text: string;
  note?: string;
  /** Green for ahead, red for behind, amber for watch, blue for neutral.
   *  Always alongside a word. Colour is never the only signal. */
  tone?: "good" | "bad" | "warn" | "info";
  source?: Source;
};

export type Cell = {
  text: string;
  note?: string;
  tone?: "good" | "bad" | "warn" | "info";
  source?: Source;
};

export type Source = { url: string; readOn: string };

/**
 * What a tool is given. Both of these are the only way out of the sandbox.
 */
export type ToolContext = {
  /**
   * The only way to read a page. Obeys robots.txt, sends no cookies, waits
   * between requests to the same site, and honours the blocked list. Returns a
   * result rather than throwing, so a refusal is something to report and not a
   * crash: "they publish no prices" is a finding.
   */
  read: (url: string) => Promise<{
    ok: boolean;
    url: string;
    text: string;
    title: string | null;
    fetchedAt: string;
    note: string;
  }>;

  /** Ask the model. Counts its own tokens into the run, so cost is measured. */
  think: (options: {
    system: string;
    prompt: string;
    /** Give a shape and you get structured data back instead of prose. */
    shape?: { name: string; description: string; input_schema: object };
    /**
     * Anthropic's own server tools, web search in particular. Passed through
     * rather than built here, because the Competitor Tracker's
     * `searchToolConfig` already carries the user_location that stops a search
     * for "barber Shrewsbury" returning Pennsylvania.
     */
    tools?: unknown[];
    hard?: boolean;    // true uses the stronger model. Only where synthesis is genuinely hard
    maxTokens?: number;
  }) => Promise<unknown>;

  /**
   * Run searches and hand back what came back, untouched.
   *
   * The results are read straight out of the response, where they arrive as
   * structured data with real urls and titles. The first version asked the
   * model to retype them into a form instead, and it answered in prose, so
   * nothing was ever collected. Worse, retyping is a chance to invent: a model
   * asked to repeat twenty urls will eventually repair one.
   */
  search: (
    terms: string[],
    toolConfig: unknown,
  ) => Promise<{ term: string; results: { url: string; title: string }[] }[]>;

  /** Say what is happening, in the customer's units. "2 of 5 competitors". */
  progress: (message: string) => void;
};

export type Tool = {
  /** Lower case with hyphens. It is the folder name and the web address. */
  slug: string;
  /** As it appears in the app. Matches the folder in Agents/. */
  name: string;
  /** One line, shown while it has nothing to show. */
  does: string;
  /** False until somebody writes run(). The workspace says so plainly. */
  built: boolean;
  /**
   * Kept out of the navigation, without being deleted.
   *
   * An unbuilt tool in the header is a promise, and six headings with four of
   * them leading to "not built yet" reads as a product that mostly does not
   * work. Hiding is not the same as removing: the spec, the folder and the
   * agent all stay, and turning one back on is deleting this line.
   */
  hidden?: boolean;
  run?: (business: Business, context: ToolContext) => Promise<ToolResult>;
};
