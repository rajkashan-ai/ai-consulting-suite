/**
 * What an owner is told when something throws.
 *
 * There was one catch around the whole pipeline and it wrote the exception's
 * own words into the field the screen reads. So a barber could be shown
 *
 *     The answer was cut off at 32000 tokens while building "comparison".
 *
 * and, for anything we had not thought about, a TypeError or the body of a rate
 * limit response, word for word. None of that is a sentence a business owner
 * can do anything with, and UI/CLAUDE.md section 7 rule 7 says nothing about
 * how the product is built reaches their screen.
 *
 * Two different readers, two different sentences. Theirs says what happened in
 * their terms and what to do. Ours keeps the real text, because the real text
 * is the only thing that makes the fault findable tomorrow.
 *
 * No clock, no database, no imports. It is given an error and returns two
 * strings, which is what lets every branch below be tested.
 */

export type Plain = { say: string; why: string };

const SOMETHING_ELSE =
  "Something went wrong at our end. Nothing has been saved. Start it again.";

/**
 * Ordered, because the first match wins and the specific ones have to come
 * before the general ones. Each `when` is matched against the error's own text.
 */
const KINDS: { when: RegExp; say: string }[] = [
  {
    // Our own: the answer hit its ceiling part way through.
    when: /\bCutOff\b|cut off at \d+|max_tokens|maximum tokens/i,
    say: "The write up came out longer than we can handle in one go. Start it again.",
  },
  {
    // Our own: asked for a shape and given prose.
    when: /\bWrongForm\b|asked for "|wrong form|expected .* got/i,
    say: "The write up came back in a form we could not use. Start it again.",
  },
  {
    when: /rate.?limit|429|too many requests|overloaded|529/i,
    say: "Too much is being asked at once. Leave it a few minutes and start it again.",
  },
  {
    when: /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|network|fetch failed/i,
    say: "We could not reach part of the web just now. Start it again.",
  },
  {
    when: /invalid url|malformed/i,
    say: "One of the addresses we were given could not be read. Check the website is right.",
  },
  {
    /**
     * Out of credit. Checked before the other 400s, because the message is a
     * 400 like any other and the right thing to say is nothing like the others.
     *
     * A real run died here on 2026-09-16 and the owner was told "something went
     * wrong at our end, start it again". It would have failed identically every
     * time. Telling somebody to retry something that cannot succeed is the
     * worst message in the product: it costs them their afternoon and it looks
     * like the product is broken rather than unpaid.
     *
     * It says "we" rather than "you" because for a paying customer this is
     * genuinely our bill, not theirs. Whoever needs to act on it finds the real
     * text on the run.
     */
    when: /credit balance|billing|quota|insufficient.*(credit|funds)|payment required|\b402\b/i,
    say: "We have run out of credit at our end, so this could not finish. Nothing has been saved and nothing has been charged to you. It will work again once that is sorted.",
  },
  {
    when: /401|403|unauthorized|forbidden|invalid.*key|authentication/i,
    say: "We could not get through to finish this. Start it again, and tell us if it keeps happening.",
  },
];

/** Turn anything that was thrown into something to show and something to keep. */
export function plainly(e: unknown): Plain {
  const why =
    e instanceof Error
      ? `${e.name}: ${e.message}${e.cause ? ` [${String(e.cause)}]` : ""}`
      : typeof e === "string"
        ? e
        : (() => {
            try {
              return JSON.stringify(e) ?? String(e);
            } catch {
              // Circular, usually. String() always gives something, and this
              // runs while we are already explaining a failure, so it must not
              // add one. Expected: ERROR-HANDLING.md rule 1, fourth case.
              return String(e);
            }
          })();

  const found = KINDS.find((k) => k.when.test(why));
  return { say: found?.say ?? SOMETHING_ELSE, why: why.slice(0, 2000) };
}

/**
 * Words that belong to us and never to the customer.
 *
 * Kept here, next to `plainly`, so the watchdog's verdicts, the pipeline's
 * failure reasons and anything thrown are all screened against one list rather
 * than three that drift apart. The test that uses it reads every failure the
 * product can produce and checks it against this.
 */
export const MACHINERY =
  /\btokens?\b|\bshapes?\b|\bschemas?\b|\bprompts?\b|\bmodels?\b|\bapi\b|\bjson\b|max_tokens|tool_use|stop_reason|\bstages?\b|\bsteps?\b|site:|\bsql\b|\bnull\b|\bundefined\b|booksy|fresha|anthropic|claude|supabase/i;
