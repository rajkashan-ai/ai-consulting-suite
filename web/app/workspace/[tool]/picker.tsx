"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { chooseCompetitors } from "./picker-actions";
import { FEWEST, OWN_LIMIT, PICK, SHOWN_FIRST, type Offer } from "@/tools/competitor-tracker/shortlist";

/**
 * Who do you actually compete with?
 *
 * WHY THE OWNER IS ASKED AT ALL
 * One listing record in twenty is wrong about the business behind it. Fresha's
 * entry for Rob's Cuts says "Women's Haircut, Locs, Children's Haircut"; they
 * cut men and boys. No rule we write can see that, because the rule reads the
 * same wrong record. The owner knows in a second.
 *
 * So the machine does what machines are good at, narrowing fifty eight to two
 * dozen, and the person does what people are good at, recognising a shop they
 * drive past.
 *
 * Ours are ticked when this opens, so agreeing costs one click and disagreeing
 * is still possible. That ordering is deliberate: a screen that makes you do
 * work before it will do any is a screen people abandon.
 */
export default function Picker({
  runId,
  offered,
  trade,
  town,
}: {
  runId: string;
  offered: Offer[];
  trade: string | null;
  town: string | null;
}) {
  const router = useRouter();
  const [ticked, setTicked] = useState<string[]>(() =>
    offered.filter((o) => o.ours).map((o) => o.name).slice(0, PICK),
  );
  const [own, setOwn] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = ticked.length + own.length >= PICK;
  const tooFew = ticked.length + own.length < FEWEST;

  /**
   * Ten on screen, the rest one click away.
   *
   * Twenty four is the right number to keep and the wrong number to look at.
   * Cutting the list instead would put our ranking back in charge of which real
   * competitors they never see, which is what this screen exists to stop.
   *
   * Anything ticked stays visible whatever happens, or unticking the eleventh
   * means hunting for it.
   */
  const shown = showAll
    ? offered
    : offered.filter((o, i) => i < SHOWN_FIRST || ticked.includes(o.name));
  const hidden = offered.length - shown.length;

  /** Said once, under the heading, rather than beside every row. Nielsen 8. */
  const note = useMemo(() => {
    const unsure = offered.filter((o) => o.unsure).length;
    if (!unsure) return null;
    return unsure === 1
      ? "One of these we could not check. It is marked."
      : `${unsure} of these we could not check. They are marked.`;
  }, [offered]);

  const toggle = (name: string) => {
    setError(null);
    setTicked((was) =>
      was.includes(name) ? was.filter((n) => n !== name) : was.length >= PICK ? was : [...was, name],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: refused } = await chooseCompetitors(runId, ticked, own);
      if (refused) {
        setError(refused);
        return;
      }
      // Reload from the server so the run is picked up and rendered by the same
      // code that renders it on every other visit. One path, not two.
      router.refresh();
    } catch (e) {
      /**
       * The network, or our own server. Either way they can try again, and the
       * reason is ours to keep rather than theirs to read. No error is
       * discarded: CLAUDE.md 1.4c.
       */
      console.error(`[picker] saving the choice failed: ${String(e)}`);
      setError("We could not reach our own server. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="t-sub">
        Which {PICK} do you compete with?
      </h2>
      <p className="t-doc u-measure">
        We found {offered.length} {trade ?? "business"}
        {offered.length === 1 ? "" : "es"} near {town ?? "you"}. We have ticked the{" "}
        {PICK} we would compare you against. Change them if we have it wrong:
        you know your market and we are reading listings.
      </p>
      {note ? <p className="t-meta u-measure">{note}</p> : null}

      <div className="rows">
        {shown.map((o) => {
          const on = ticked.includes(o.name);
          return (
            <label className="check" key={o.name}>
              <input
                type="checkbox"
                checked={on}
                disabled={saving || (!on && full)}
                onChange={() => toggle(o.name)}
              />
              <span>
                <span className="t-row t-strong">{o.name}</span>
                {o.unsure ? <span className="tag tag--na">Not checked</span> : null}
                <span className="t-micro">
                  {[
                    o.area,
                    o.miles === null ? null : `${o.miles.toFixed(1)} miles`,
                    o.rating === null ? null : `${o.rating} stars`,
                    o.reviews === null ? null : `${o.reviews} reviews`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {/* What we make of them, and whose reading it is, so they can
                    disagree with a claim rather than with a bare name. */}
                {o.reads ? (
                  <span className="t-meta">
                    {o.reads}
                    {o.from ? ` · ${o.from}` : ""}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {hidden > 0 ? (
        <button className="btn--ghost" onClick={() => setShowAll(true)} disabled={saving}>
          Show the other {hidden}
        </button>
      ) : null}

      {/* Somebody who already knows should not have to find us first. */}
      <div className="rows">
        {own.map((name) => (
          <p className="t-row" key={name}>
            {name}
            <button
              className="btn--sm"
              onClick={() => setOwn((was) => was.filter((n) => n !== name))}
              disabled={saving}
            >
              Remove
            </button>
          </p>
        ))}
        {own.length < OWN_LIMIT && !full ? (
          <p className="t-meta">
            <label htmlFor="own">Not here? Add one by name</label>
            <input
              id="own"
              className="field"
              value={typing}
              disabled={saving}
              placeholder="Their name as a customer would say it"
              onChange={(e) => setTyping(e.target.value)}
            />
            <button
              className="btn--ghost"
              disabled={saving || typing.trim().length < 2}
              onClick={() => {
                setOwn((was) => [...was, typing.trim()]);
                setTyping("");
                setError(null);
              }}
            >
              Add
            </button>
          </p>
        ) : null}
        {own.length ? (
          <p className="t-micro">
            We will look for their prices. If we cannot find them, they are still
            in your comparison with the cells we could not fill left empty.
          </p>
        ) : null}
      </div>

      {/* The count is next to the button, where the decision is made. */}
      <p className="t-meta">
        {ticked.length + own.length} of {PICK} chosen
        {full ? ". Remove one to swap it." : ""}
      </p>
      {error ? <p className="t-doc">{error}</p> : null}

      <button className="btn" onClick={save} disabled={saving || tooFew}>
        {saving ? "Saving" : "Compare these"}
      </button>
      {tooFew ? (
        <p className="t-meta">
          Choose at least {FEWEST}. Comparing you against one business is not a
          comparison.
        </p>
      ) : null}
    </div>
  );
}
