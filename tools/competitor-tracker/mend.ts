import type { Area, Battlecard, Claim } from "../../../Agents/Competitor Tracker/src/types.ts";

/**
 * Fixing one sentence, not the whole card.
 *
 * WHY THIS REPLACED THE WHOLE-CARD REWRITE
 * Six runs failed at the checks today. The repair was handed the entire card
 * and asked to reword the parts that were refused, so it rewrote sixty
 * sentences to fix one, and the rewrite introduced a new fault somewhere else.
 * The second check refused a different sentence and the run died. That cannot
 * converge: every attempt is a fresh chance to break something.
 *
 * A sentence is found, replaced, and nothing else moves. If the replacement is
 * no better, the claim carrying it is dropped. A shorter true card beats a
 * refused one, and dropping is a floor that always terminates.
 */

export type Spot =
  | { kind: "claim"; competitor: number; area: string; index: number }
  | { kind: "action-headline"; action: number }
  | { kind: "action-why"; action: number }
  | { kind: "action-evidence"; action: number; index: number };

/**
 * Where a refused sentence lives.
 *
 * The guards hand back the sentence as it appeared, and asText adds a full stop
 * to anything lacking one, so both forms are tried.
 */
export function find(card: Battlecard, sentence: string): Spot[] {
  const want = [sentence.trim(), sentence.trim().replace(/\.$/, "")];
  const hit = (text: string | undefined) =>
    Boolean(text && want.some((w) => w.length > 8 && text.trim().startsWith(w.slice(0, 60))));

  const spots: Spot[] = [];

  card.competitors.forEach((c, competitor) => {
    for (const [area, claims] of Object.entries(c.claims ?? {})) {
      (claims ?? []).forEach((claim, index) => {
        if (hit(claim.text)) spots.push({ kind: "claim", competitor, area, index });
      });
    }
  });

  card.actions.forEach((a, action) => {
    if (hit(a.headline)) spots.push({ kind: "action-headline", action });
    if (hit(a.why)) spots.push({ kind: "action-why", action });
    (a.evidence ?? []).forEach((e, index) => {
      if (hit(e.text)) spots.push({ kind: "action-evidence", action, index });
    });
  });

  return spots;
}

/** The words at a spot, or null if the card has moved underneath it. */
export function read(card: Battlecard, spot: Spot): string | null {
  if (spot.kind === "claim") {
    const claims: Claim[] | undefined =
      card.competitors[spot.competitor]?.claims?.[spot.area as Area];
    return claims?.[spot.index]?.text ?? null;
  }
  const action = card.actions[spot.action];
  if (!action) return null;
  if (spot.kind === "action-headline") return action.headline;
  if (spot.kind === "action-why") return action.why;
  return action.evidence?.[spot.index]?.text ?? null;
}

/**
 * Put new words at a spot, or take the whole claim out.
 *
 * Deep copied, so a failed attempt never leaves the card half changed.
 */
export function write(card: Battlecard, spot: Spot, words: string | null): Battlecard {
  const next = structuredClone(card);

  if (spot.kind === "claim") {
    const claims: Claim[] | undefined =
      next.competitors[spot.competitor]?.claims?.[spot.area as Area];
    if (!claims) return next;
    if (words === null) claims.splice(spot.index, 1);
    else claims[spot.index].text = words;
    return next;
  }

  const action = next.actions[spot.action];
  if (!action) return next;

  if (spot.kind === "action-headline") {
    // A headline cannot be dropped: an action without one is not an action.
    if (words !== null) action.headline = words;
    return next;
  }
  if (spot.kind === "action-why") {
    if (words !== null) action.why = words;
    return next;
  }
  if (words === null) action.evidence.splice(spot.index, 1);
  else action.evidence[spot.index].text = words;
  return next;
}

/**
 * Can this sentence be dropped rather than mended?
 *
 * A claim can go: the card is shorter and still true. A headline cannot, and an
 * action's last piece of evidence cannot, because removing it turns a supported
 * action into an unsupported one, which is a worse fault than the wording.
 */
export function droppable(card: Battlecard, spot: Spot): boolean {
  if (spot.kind === "claim") return true;
  if (spot.kind === "action-headline" || spot.kind === "action-why") return false;
  return (card.actions[spot.action]?.evidence?.length ?? 0) > 1;
}
