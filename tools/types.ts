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
  trade: string | null;   // "barber", "plumber". Decides where a tool even looks
  town: string | null;
  oneLiner: string | null;
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
    hard?: boolean;    // true uses the stronger model. Only where synthesis is genuinely hard
    maxTokens?: number;
  }) => Promise<unknown>;

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
  run?: (business: Business, context: ToolContext) => Promise<ToolResult>;
};
