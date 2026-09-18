/**
 * What a profile form actually changes.
 *
 * Pure, and in its own file, because the rule it carries is the kind that is
 * wrong in a way nobody notices: a blank box that quietly deletes something
 * they told us last week.
 *
 * SILENCE IS NOT A CORRECTION
 * A field that is not in the form at all means "I was not asked". A field that
 * is present and empty means "you have this wrong, take it out". They look the
 * same once the value reaches the server, and only one of them should write
 * anything, so the presence of the key is what tells them apart.
 *
 * This matters most for channels. "We asked and they post nowhere" and "nobody
 * asked" are different answers, and only one of them should let the planner
 * fall back to guessing from their page text.
 */

export const TEXT_FIELDS = ["name", "website", "address", "town", "one_liner"] as const;

/** An address we would send someone's work to. Checked, never assumed. */
export const looksLikeEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export type Changes = Record<string, unknown>;

export function changesFrom(
  form: { has: (k: string) => boolean; get: (k: string) => unknown; getAll: (k: string) => unknown[] },
  knownChannels: readonly string[],
): Changes | { error: string } {
  const said = (key: string): string | null | undefined => {
    if (!form.has(key)) return undefined;
    const v = String(form.get(key) ?? "").trim();
    return v === "" ? null : v;
  };

  const change: Changes = {};
  for (const key of TEXT_FIELDS) {
    const v = said(key);
    if (v !== undefined) change[key] = v;
  }

  const email = said("contact_email");
  if (email !== undefined) {
    if (email !== null && !looksLikeEmail(email)) {
      return { error: "That does not look like an email address." };
    }
    change.contact_email = email;
  }

  /* Only when the form carried the marker, so an unticked set is a real answer
     and an absent one is silence. */
  if (form.has("channelsAsked")) {
    const known = new Set(knownChannels);
    change.channels = form
      .getAll("channel")
      .map((c) => String(c))
      .filter((c) => known.has(c));
  }

  return change;
}
