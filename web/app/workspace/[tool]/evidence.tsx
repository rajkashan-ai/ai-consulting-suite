/**
 * What a claim is based on, printed beside it rather than hidden behind it.
 *
 * WHY THIS IS NOT A DISCLOSURE
 * It was one. `<details>` collapsed, with "What this is based on" as the
 * summary, and the reasoning written next to it was "they see the point, and
 * open it if they want to argue with it".
 *
 * That makes the default state of this product a product that asserts. The
 * handoff of 2026-09-18 is blunt about it: always visible, never inside a
 * disclosure or a tooltip, because this is the differentiator and hiding it
 * removes it. Nobody opens a disclosure to check something they already
 * believe, so the collapsed version was only ever read by people who had
 * already decided we were wrong.
 *
 * TWO KINDS, AND THE DIFFERENCE MATTERS
 * `src` is a page we read, on a date, and it is green. `ours` is our own read
 * of those pages, and it is berry. A claim with nothing behind it says `ours`
 * out loud rather than going quiet, which is the house rule on saying when we
 * do not know, made structural.
 */

export type Stamp = {
  kind: "src" | "ours";
  /** Where it came from, already written for a person. Never a raw url. */
  value: string;
  /** The claim itself, when there is one to show above the stamp. */
  text?: string;
};

export function EvidenceStamp({ kind, value, text }: Stamp) {
  return (
    <li className={`stamp stamp--${kind}`}>
      {text ? <span className="stamp__t">{text}</span> : null}
      <span className="stamp__line">
        <span className="stamp__k">{kind}</span>
        <span className="stamp__v">{value}</span>
      </span>
    </li>
  );
}

/**
 * The list, with its own heading, because a stamp on its own is unlabelled.
 *
 * Renders nothing at all when there is nothing to stamp. An empty "What this is
 * based on" is worse than no heading: it implies evidence exists and is missing.
 */
export default function Evidence({ stamps }: { stamps: Stamp[] }) {
  if (!stamps.length) return null;
  return (
    <div className="evidence">
      <p className="t-kind">what this is based on</p>
      <ul className="evidence__list">
        {stamps.map((s, i) => (
          <EvidenceStamp key={i} {...s} />
        ))}
      </ul>
    </div>
  );
}
