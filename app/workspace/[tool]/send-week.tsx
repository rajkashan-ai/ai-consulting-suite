"use client";

/**
 * Take this week with you.
 *
 * "Approve this week" used to sit here and did nothing: no handler, and by
 * design it only set a flag the per-post control already sets. It was the most
 * consequential-sounding word on the screen attached to the least consequential
 * action, and it took Raj asking what it did to find that out.
 *
 * What an owner actually needs on a Monday is the words where they will be when
 * they post, which is their phone. Read off the page rather than a second copy,
 * so it cannot drift from what they are looking at.
 */
export default function SendWeek() {
  function take() {
    const lines: string[] = [];
    const cards = document.querySelectorAll("#this-week .card");
    const blanks: string[] = [];

    const n = cards.length;
    const WORD = ["no", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    lines.push(
      `${WORD[n] ?? n} post${n === 1 ? "" : "s"} this week. The day${n === 1 ? " is a suggestion" : "s are a suggestion"}, a day later is fine.`,
      "",
    );

    cards.forEach((card) => {
      const when = card.querySelector(".card__head .t-card")?.textContent ?? "";
      const where = card.querySelector(".card__head .t-meta")?.textContent ?? "";
      const words = card.querySelector(".card__body > .t-doc")?.textContent?.trim() ?? "";
      const shot = card.querySelector(".inset .t-row")?.textContent?.trim() ?? "";
      if (!when || !words) return;

      lines.push("-----------------------------------------");
      lines.push(`${when.toUpperCase()}  ·  ${where}`, "", words, "");
      if (shot) lines.push(`PHOTOGRAPH: ${shot}`, "");
      for (const b of words.match(/\[[^\]]+\]/g) ?? []) blanks.push(`${when}: ${b.replace(/^\[|\]$/g, "")}`);
    });

    if (blanks.length) {
      lines.push("-----------------------------------------", "A LINE FROM YOU", "");
      for (const b of blanks) lines.push(`  ${b}`);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "this-week.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="card">
      <div className="card__foot">
        <p className="t-doc-sm">
          Take them with you. The words, what to bring and the days, in one file you can open on
          your phone.
        </p>
        <button className="btn" type="button" onClick={take}>
          Send me this week
        </button>
      </div>
    </div>
  );
}
