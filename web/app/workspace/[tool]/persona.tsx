"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { report } from "../../report";
import { chooseStyle, previewStyle, readPersona } from "./persona-actions";
import {
  SAMPLES_MAX,
  STYLES,
  type Persona,
  type StyleId,
} from "@/tools/content-social-planner/persona";

/**
 * Brand Persona: how they sound, and the choice of sounding otherwise.
 *
 * First on the page, because everything written for them is written in this
 * voice. It used to be two sentences near the bottom, described and never
 * offered, so an owner who did not like how they came across had nowhere to go.
 *
 * Three steps, in the order somebody would do them: tell us where to look, see
 * what we found, try another voice on your own words before anything changes.
 */
export default function BrandPersona({
  workspaceId,
  persona,
  style,
  samples,
  inspiration,
}: {
  workspaceId: string;
  persona: Persona | null;
  style: StyleId;
  samples: string[];
  inspiration: string | null;
}) {
  const router = useRouter();
  const [pasted, setPasted] = useState(samples.join("\n\n"));
  const [admire, setAdmire] = useState(inspiration ?? "");
  const [busy, setBusy] = useState<null | "reading" | "trying" | "choosing">(null);
  const [error, setError] = useState<string | null>(null);
  const [tryout, setTryout] = useState<{ style: StyleId; before: string; after: string } | null>(null);

  /**
   * Theirs to try again, ours to keep the reason.
   *
   * Recorded through `report` rather than logged, so a fault on somebody
   * else's browser reaches us at all: a console line on their machine is a
   * fault nobody ever sees. CLAUDE.md 1.4c, and the guard in
   * error-handling.test.ts that caught this being only a log.
   */
  const say = (e: unknown, where: string, plain: string) => {
    report(e, where, workspaceId, "fault");
    setError(plain);
  };

  const read = async () => {
    setBusy("reading");
    setError(null);
    setTryout(null);
    try {
      const { error: refused } = await readPersona(workspaceId, pasted, admire);
      if (refused) setError(refused);
      router.refresh();
    } catch (e) {
      say(e, "working out the voice", "We could not reach our own server. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const tryIt = async (id: StyleId) => {
    setBusy("trying");
    setError(null);
    try {
      const got = await previewStyle(workspaceId, id);
      if (got.error) setError(got.error);
      else if (got.before && got.after) setTryout({ style: id, before: got.before, after: got.after });
    } catch (e) {
      say(e, "trying a voice", "We could not reach our own server. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const keep = async (id: StyleId) => {
    setBusy("choosing");
    setError(null);
    try {
      const { error: refused } = await chooseStyle(workspaceId, id);
      if (refused) setError(refused);
      else {
        setTryout(null);
        router.refresh();
      }
    } catch (e) {
      say(e, "keeping a voice", "We could not reach our own server. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const parts: [string, string][] = persona
    ? [
        ["How you come across", persona.tone],
        ["How you build a sentence", persona.style],
        ["Words you use", persona.uses.join(", ")],
        ["Words you never use", persona.avoids.join(", ")],
      ].filter(([, v]) => v) as [string, string][]
    : [];

  return (
    <div className="panel">
      <h2 className="t-sub">Brand Persona</h2>
      <p className="t-doc u-measure">
        Everything we write for you is written in this voice. Show us how you
        already talk to your customers, and change it if you would rather sound
        different.
      </p>

      {/* ── Tell us where to look ─────────────────────────────────────── */}
      <div className="make">
        <label className="t-meta" htmlFor="pasted">
          Paste up to {SAMPLES_MAX} posts of yours, with a blank line between them
        </label>
        <textarea
          id="pasted"
          className="field field--area"
          rows={5}
          value={pasted}
          disabled={busy !== null}
          placeholder="Paste a couple of your own captions here"
          onChange={(e) => { setPasted(e.target.value); setError(null); }}
        />
        <p className="t-micro">
          Your own posts are the truest sample. We cannot read Instagram or
          Facebook: both ask us not to, and we do not go around that. We read
          your website too.
        </p>

        <label className="t-meta" htmlFor="admire">
          Somebody whose writing you like, if there is one. A website or a blog.
        </label>
        <div className="make__row">
          <input
            id="admire"
            className="field"
            value={admire}
            disabled={busy !== null}
            placeholder="theirwebsite.co.uk"
            onChange={(e) => { setAdmire(e.target.value); setError(null); }}
          />
          <button className="btn" onClick={read} disabled={busy !== null}>
            {busy === "reading" ? "Reading" : persona ? "Read it again" : "Work out my voice"}
          </button>
        </div>
      </div>

      {error ? <p className="t-doc">{error}</p> : null}

      {/* ── What we found ─────────────────────────────────────────────── */}
      {persona ? (
        <>
          <div className="persona">
            {parts.map(([what, said]) => (
              <span className="persona__part" key={what}>
                <span className="persona__what">{what}</span>
                <span className="persona__said">{said}</span>
              </span>
            ))}
          </div>

          {/* ── Try another voice ───────────────────────────────────────── */}
          <p className="t-meta u-measure">
            Want to sound different? Try one on a post of your own. Nothing
            changes until you keep it, and your own voice is always here.
          </p>

          <div className="voices">
            {STYLES.map((s) => (
              <button
                key={s.id}
                className={`intent${s.id === "original" ? " voice--original" : ""}`}
                aria-pressed={style === s.id}
                disabled={busy !== null}
                onClick={() => tryIt(s.id)}
              >
                <span className="intent__kind">
                  {style === s.id ? "Yours now" : s.id === "original" ? "What we read" : "Try it"}
                </span>
                <span className="intent__name">{s.label}</span>
                <span className="intent__asks">{s.sounds}</span>
              </button>
            ))}
          </div>

          {tryout ? (
            <>
              <div className="tryout">
                <span className="tryout__side">
                  <span className="persona__what">As you wrote it</span>
                  <span className="tryout__words">{tryout.before}</span>
                </span>
                <span className="tryout__side">
                  <span className="persona__what">
                    {STYLES.find((s) => s.id === tryout.style)?.label}
                  </span>
                  <span className="tryout__words">{tryout.after}</span>
                </span>
              </div>
              <div className="make__row">
                <button
                  className="btn"
                  disabled={busy !== null || style === tryout.style}
                  onClick={() => keep(tryout.style)}
                >
                  {style === tryout.style ? "This is your voice" : "Keep this voice"}
                </button>
                <button className="btn--ghost" disabled={busy !== null} onClick={() => setTryout(null)}>
                  Leave it as it is
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
