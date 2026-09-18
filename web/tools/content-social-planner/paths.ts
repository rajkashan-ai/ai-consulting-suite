/**
 * The three ways an owner asks for a post, and the eight reasons to write one.
 *
 * WHY THIS EXISTS
 * The tool laid out a month and wrote a week of it. That is a calendar, and a
 * calendar a small business did not ask for produces guilt rather than posts.
 * Raj, 2026-09-17: the three moments a non-corporate operator actually reaches
 * for this are a blank screen with no ideas, a thing that just happened in the
 * business, and a photo already on their phone.
 *
 * The month stays: it is the prompter that gives the blank screen something to
 * react to. What is added is the asking.
 *
 * Nothing here talks to a model or a database. It is the vocabulary and the
 * rules about it, so both can be tested without either.
 */

/**
 * Why this post exists, in the owner's terms rather than ours.
 *
 * Eight, and no more, because a menu long enough to browse is a menu that
 * replaces the blank screen with a different blank screen. Each carries what it
 * asks the reader to do, which is what makes the writing different rather than
 * the label.
 */
export const INTENTS = [
  { id: "educate", label: "Educate", asks: "Teach them something useful they did not know." },
  { id: "inspire", label: "Inspire", asks: "Show them a better result than the one they have." },
  { id: "entertain", label: "Entertain", asks: "Make them smile or react. No sell at all." },
  { id: "inform", label: "Inform", asks: "Tell them something they need to know: hours, changes, news." },
  { id: "connect", label: "Connect", asks: "Show the people and the story behind the business." },
  { id: "prove", label: "Prove", asks: "Show the work, so the promise is believable." },
  { id: "promote", label: "Promote", asks: "Give one clear reason to book or buy." },
  { id: "engage", label: "Engage", asks: "Give them a reason to reply or take part." },
] as const;

export type Intent = (typeof INTENTS)[number]["id"];

/**
 * Which intents build trust and which ask for the business.
 *
 * Raj's 80/20: five categories carry no sales pressure and three do. Used to
 * tell the owner where a choice sits, never to refuse one. Somebody who has
 * promoted three times running has a reason we cannot see, and a tool that
 * argues with them is a tool they stop opening.
 */
export const CONVERTS: ReadonlySet<Intent> = new Set(["prove", "promote", "engage"]);

export const isIntent = (x: unknown): x is Intent =>
  typeof x === "string" && INTENTS.some((i) => i.id === x);

export const intentAsks = (id: Intent): string =>
  INTENTS.find((i) => i.id === id)?.asks ?? "";

/** How a post was asked for. `asset` exists and is not built: see PATHS. */
export const PATHS = ["category", "thought", "asset"] as const;
export type Path = (typeof PATHS)[number];

/**
 * Paths on the screen that do nothing yet.
 *
 * Empty since 2026-09-18, when starting from a photo was built. It stays as a
 * set rather than being deleted: it is the mechanism that keeps a half built
 * path honest on screen, and the next one will want it. `next` refuses to
 * select anything in here and the action refuses to run it, so a path is
 * disabled in one place rather than three.
 */
export const NOT_BUILT: ReadonlySet<Path> = new Set();

export const isPath = (x: unknown): x is Path =>
  typeof x === "string" && (PATHS as readonly string[]).includes(x);

/** The fewest characters that are a thought rather than a slip of the keyboard. */
export const THOUGHT_MIN = 12;
export const THOUGHT_MAX = 600;

/**
 * Their rough thought, made safe to expand.
 *
 * Trimmed and length-checked, and that is all. It is not a claim we are going
 * to publish: it is the owner telling us what happened, and the post written
 * from it goes through the same guards as every other post, so an invented
 * price in the output is caught where every other invented price is caught.
 */

/**
 * Their own words, tidied and not rewritten.
 *
 * CRITICAL, and this got it wrong. Both places that took the owner's raw prose
 * ran `.replace(/\s+/g, " ")`, which collapses newlines along with spaces. So
 *
 *     Balayage, £95
 *     Book two weeks ahead
 *     Ask for Sarah
 *
 * reached the writer as one flat line, and the shape they typed, which is their
 * cadence, was gone before anything read it. We then asked the writer to sound
 * like them.
 *
 * Runs of spaces and tabs collapse, because "a" then eleven spaces then "b" is
 * not thirteen characters of thought and the length guards depend on that. Line
 * breaks survive. More than one blank line in a row becomes one, which is
 * tidying the gaps rather than the prose.
 *
 * Nothing else is touched: not their capitals, not their punctuation, not their
 * spelling, not a full stop they left off.
 */
export function asTheyTypedIt(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function asThought(raw: unknown): { text: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Tell us what happened and we will write it up." };
  const text = asTheyTypedIt(raw);
  if (text.length < THOUGHT_MIN) {
    return { error: "A few more words and we can work with it. What happened?" };
  }
  if (text.length > THOUGHT_MAX) {
    return { error: `That is longer than we need. Give us the gist, up to ${THOUGHT_MAX} characters.` };
  }
  return { text };
}

/**
 * Why a request cannot be run, in the owner's words, or null.
 *
 * The photo path asks for one thing the other two do not: which service the
 * photo shows. A photo carries no price and no booking link, so on its own it
 * can only produce a description. Pairing it with a service they actually sell
 * is what lets the facts come off the page while the look comes off the photo.
 */
export function wrongWithRequest(
  path: unknown,
  intent: unknown,
  thought: unknown,
  photo: unknown = null,
): string | null {
  if (!isPath(path)) return "Choose how you want to start.";
  if (NOT_BUILT.has(path)) return "That way of starting is not ready yet.";

  if (path === "category") {
    return isIntent(intent) ? null : "Choose what the post is for.";
  }

  if (path === "asset") {
    if (typeof photo !== "string" || !photo) return "Choose a photo.";
    /**
     * The notes are optional, and that is deliberate.
     *
     * This asked them to pick one of their services from a list, and for a
     * salon whose site lists twelve grades of the same cut that is twelve long
     * buttons and a decision nobody wants to make on a phone between clients.
     * Worse, a list can be wrong: the photo may be of something the list does
     * not name.
     *
     * So they write what they want mentioned, or they write nothing and we
     * work from the photo and their own pages. A post nobody could be bothered
     * to configure is still worth more than no post.
     */
    return null;
  }

  // A thought on its own is enough: they have told us what happened, and what
  // it is for follows from that rather than being asked for twice.
  const said = asThought(thought);
  return "error" in said ? said.error : null;
}

/**
 * The Make screen's state, and the only place its transitions are decided.
 *
 * WHY THIS IS NOT LEFT IN THE COMPONENT
 * The button's "can they ask yet" and the action's "will we accept this" were
 * two separate rules for the same question, and they disagreed. The letter "a",
 * eleven spaces and the letter "b" is thirteen characters, so the button lit;
 * asThought collapses the run of spaces to one, leaves three characters, and
 * refuses. Two halves of one question disagreeing is how every fault in this
 * product has started, so there is one rule now and both ask it.
 *
 * Keeping the transitions here as well means they can be checked without a
 * browser: no click, no render, just a state and an action.
 */
export type MakeState = {
  path: Path;
  intent: Intent | null;
  thought: string;
  /** The downscaled photo as a data url, held in memory and never stored. */
  photo: string | null;
  /** What they want mentioned, in their own words. Empty is allowed. */
  notes: string;
  error: string | null;
};

export const START: MakeState = {
  path: "category",
  intent: null,
  thought: "",
  photo: null,
  notes: "",
  error: null,
};

export type MakeAction =
  | { did: "pick-path"; path: Path }
  | { did: "pick-intent"; intent: Intent }
  | { did: "type"; thought: string }
  | { did: "pick-photo"; photo: string | null }
  | { did: "note"; notes: string }
  | { did: "refused"; error: string }
  | { did: "written" };

export function next(state: MakeState, action: MakeAction): MakeState {
  switch (action.did) {
    /**
     * A path we have not built never becomes the path.
     *
     * The screen draws that button disabled. This is what makes it true, so a
     * later change to the markup cannot quietly let it through.
     */
    case "pick-path":
      if (NOT_BUILT.has(action.path)) return state;
      // Whatever they were told was about the last request, and the last
      // request is over the moment they start a different one.
      return { ...state, path: action.path, error: null };

    case "pick-intent":
      return { ...state, intent: action.intent, error: null };

    case "type":
      return { ...state, thought: action.thought, error: null };

    case "pick-photo":
      return { ...state, photo: action.photo, error: null };

    case "note":
      return { ...state, notes: action.notes, error: null };

    case "refused":
      return { ...state, error: action.error };

    // Written and saved. The screen is ready for the next one, and the words
    // they used are gone rather than sitting there looking unsent.
    case "written":
      return { ...state, intent: null, thought: "", photo: null, notes: "", error: null };
  }
}

/** Whether the button is live. The same rule the action applies, asked once. */
export const readyToAsk = (s: MakeState): boolean =>
  wrongWithRequest(s.path, s.intent, s.thought, s.photo) === null;

/** Which of the three the screen is drawing. One path, one answer. */
export const showsThoughtBox = (s: MakeState): boolean => s.path === "thought";
export const showsPhotoBox = (s: MakeState): boolean => s.path === "asset";
export const showsIntents = (s: MakeState): boolean => s.path === "category";

/** The most we carry from the notes box. A few points, not an essay. */
export const NOTES_MAX = 500;

/**
 * Their notes, tidied, or nothing.
 *
 * Never an error. Notes are optional by design, so an empty box, whitespace, or
 * something that is not a string all mean the same thing: write the post from
 * the photo and their pages. The one thing that is enforced is a length, so a
 * pasted page does not become the prompt.
 *
 * What they write is not a claim we publish. It is the owner telling us what to
 * mention, and the post written from it goes through the same guards as every
 * other post, so an invented price in the output is caught where every other
 * invented price is caught.
 */
export function asNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return asTheyTypedIt(raw).slice(0, NOTES_MAX);
}

/**
 * A post split into the words we wrote and the blanks only they can fill.
 *
 * WHY A BLANK AND NOT A REFUSAL
 * The writer needed a figure nobody had given it and invented £141.00, which
 * `findInventedClaims` caught and the whole post was thrown away. The owner saw
 * "we wrote one and would not stand behind it" and got nothing.
 *
 * Refusing was right about the number and wrong about the outcome. The honest
 * move is to leave the gap where the number goes and say whose it is, which is
 * what the monthly plan always did: `[your price for this]` renders as an amber
 * chip carrying its own instruction, and the owner types over it.
 *
 * Square brackets because that is the shape the planner has always used, and
 * because a model asked for a placeholder invents a plausible one unless the
 * shape is spelled out.
 */
export type Piece = { text: string; blank: boolean };

/**
 * What a gap looks like, written once and used twice.
 *
 * It was `startsWith("[") && endsWith("]")` on the piece, which is not the same
 * question as "did this match the pattern we split on". A model that pastes a
 * paragraph inside brackets produces one piece that begins and ends with them,
 * and it became a single amber chip holding eighty characters. Two halves of
 * one question, found by the test written beside it.
 */
const GAP = /^\[[^\]]{1,60}\]$/;

export function inPieces(words: string): Piece[] {
  return words
    .split(/(\[[^\]]{1,60}\])/g)
    .filter((part) => part !== "")
    .map((part) =>
      GAP.test(part)
        ? { text: part.slice(1, -1).trim(), blank: true }
        : { text: part, blank: false },
    );
}

/** How many gaps are waiting on them. Nothing to fill is the common case. */
export const blanksIn = (words: string): number =>
  inPieces(words).filter((p) => p.blank).length;
