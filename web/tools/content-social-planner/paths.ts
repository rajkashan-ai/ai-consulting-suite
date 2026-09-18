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
 * Asset-first is on the screen and does nothing yet.
 *
 * Nothing in this product uploads a file: no bucket, no route, no image into a
 * model call. Writing that unbacked would be worse than the gap. It is shown
 * disabled so the shape of the tool is honest about what is coming, and this
 * set is what the action refuses.
 */
export const NOT_BUILT: ReadonlySet<Path> = new Set(["asset"]);

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
export function asThought(raw: unknown): { text: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Tell us what happened and we will write it up." };
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < THOUGHT_MIN) {
    return { error: "A few more words and we can work with it. What happened?" };
  }
  if (text.length > THOUGHT_MAX) {
    return { error: `That is longer than we need. Give us the gist, up to ${THOUGHT_MAX} characters.` };
  }
  return { text };
}

/** Why a request cannot be run, in the owner's words, or null. */
export function wrongWithRequest(path: unknown, intent: unknown, thought: unknown): string | null {
  if (!isPath(path)) return "Choose how you want to start.";
  if (NOT_BUILT.has(path)) return "Starting from a photo is not ready yet.";

  if (path === "category") {
    return isIntent(intent) ? null : "Choose what the post is for.";
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
  error: string | null;
};

export const START: MakeState = { path: "category", intent: null, thought: "", error: null };

export type MakeAction =
  | { did: "pick-path"; path: Path }
  | { did: "pick-intent"; intent: Intent }
  | { did: "type"; thought: string }
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

    case "refused":
      return { ...state, error: action.error };

    // Written and saved. The screen is ready for the next one, and the words
    // they used are gone rather than sitting there looking unsent.
    case "written":
      return { ...state, intent: null, thought: "", error: null };
  }
}

/** Whether the button is live. The same rule the action applies, asked once. */
export const readyToAsk = (s: MakeState): boolean =>
  wrongWithRequest(s.path, s.intent, s.thought) === null;

/** Which half of the screen is drawn. */
export const showsThoughtBox = (s: MakeState): boolean => s.path !== "category";
