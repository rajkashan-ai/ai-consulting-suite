"use client";

import { useState } from "react";

/**
 * Mark one claim or action as wrong.
 *
 * Four verdicts from a list, never a text box on its own. A count of "eleven
 * people said the actions do not fit" is a decision. Eleven paragraphs of prose
 * is a reading job nobody does. UI/CLAUDE.md 6a settled that on 14 September,
 * and the note is there for the thing the list did not think of.
 *
 * It sits outside the document itself, structurally, so it can never reach an
 * export of the battlecard. Section 7.2 of the same file.
 */

const VERDICTS = [
  { id: "wrong", label: "Wrong", why: "This is not true" },
  { id: "weak", label: "Weak", why: "True, and not worth saying" },
  { id: "useless", label: "No use", why: "True, and I cannot act on it" },
  { id: "missing", label: "Missing", why: "Something should be here and is not" },
] as const;

export default function Mark({
  workspaceId,
  documentId,
  runId,
  target,
  said,
}: {
  workspaceId: string;
  documentId: string | null;
  runId: string | null;
  target: string;
  said: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function send(verdict: string) {
    setDone(verdict);
    setOpen(false);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, documentId, runId, target, said, verdict, note }),
    }).catch(() => {
      // A mark that did not save is worse than none, because it looks saved.
      setDone(null);
    });
  }

  if (done) {
    return (
      <span className="mark mark--done t-micro">
        Marked {VERDICTS.find((v) => v.id === done)?.label.toLowerCase()}
      </span>
    );
  }

  if (!open) {
    return (
      <button className="mark t-micro" type="button" onClick={() => setOpen(true)}>
        Not right?
      </button>
    );
  }

  return (
    <span className="mark__open">
      {VERDICTS.map((v) => (
        <button
          key={v.id}
          className="btn--sm btn--ghost"
          type="button"
          title={v.why}
          onClick={() => send(v.id)}
        >
          {v.label}
        </button>
      ))}
      <input
        className="field mark__note"
        placeholder="Anything else? Optional"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="mark t-micro" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  );
}

/**
 * Copy everything behind this battlecard.
 *
 * One button, because the alternative was describing in prose which of thirty
 * claims was wrong, which page it came from and what the guards thought, and
 * that was slow and lossy every time.
 */
export function CopyEverything({ runId }: { runId: string }) {
  const [said, setSaid] = useState("Copy everything behind this");

  async function copy() {
    setSaid("Getting it");
    try {
      const res = await fetch(`/api/runs/${runId}/export`);
      const body = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(body, null, 1));
      setSaid("Copied. Paste it to Claude");
    } catch {
      setSaid("Could not copy it");
    }
    setTimeout(() => setSaid("Copy everything behind this"), 6000);
  }

  return (
    <div className="diag">
      <button className="btn--ghost" type="button" onClick={copy}>
        {said}
      </button>
      <span className="t-meta">
        Every page read, how the five were chosen, what the checks said, what it
        cost, and anything you marked. No page text, which would be too big to
        paste and is not ours to pass around.
      </span>
    </div>
  );
}
