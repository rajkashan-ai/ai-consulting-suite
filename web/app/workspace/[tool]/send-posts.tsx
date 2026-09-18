"use client";

import { useState } from "react";
import { sendPosts } from "./send-actions";

/**
 * Take the posts with you.
 *
 * This replaced "Send me this week", which sat under the written week and did
 * not send anything: it walked the rendered page for text and downloaded a
 * file. The most consequential-sounding word on the screen attached to the
 * least consequential action, for the second time on this screen.
 *
 * It now emails them, and it does not ask for an address it already has. They
 * signed in with one. The field is there for the case where the posts should go
 * somewhere else, a shared salon inbox rather than the owner's own, and it is
 * shut until they ask for it.
 */
export default function SendPosts({
  workspaceId,
  knownEmail,
}: {
  workspaceId: string;
  knownEmail: string | null;
}) {
  // Every hook together at the top, above anything that reads them.
  const [elsewhere, setElsewhere] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setSaid(null);
    try {
      const { error, sentTo } = await sendPosts(workspaceId, elsewhere ? to : null);
      setSaid(error ?? `Sent to ${sentTo}. It should be there in a minute.`);
      if (!error) {
        setElsewhere(false);
        setTo("");
      }
    } catch (e) {
      /* Ours or the network's. Kept rather than swallowed: CLAUDE.md 1.4c. */
      console.error(`[send] emailing the posts failed: ${String(e)}`);
      setSaid("We could not reach our own server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card__foot">
        <p className="t-doc-sm">
          Take them with you. The words, what to photograph and where each one
          came from, in one email you can open on your phone.
        </p>
        <button className="btn" type="button" onClick={send} disabled={busy}>
          {busy ? "Sending" : "Email these to me"}
        </button>
      </div>

      <div className="make">
        {elsewhere ? (
          <>
            <label className="t-meta" htmlFor="to">
              Send them where instead?
            </label>
            <input
              id="to"
              className="field"
              type="email"
              value={to}
              disabled={busy}
              placeholder="bookings@yoursalon.co.uk"
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        ) : (
          <p className="t-micro">
            {knownEmail ? `They go to ${knownEmail}.` : "They go to the address you signed in with."}{" "}
            <button className="linkish" type="button" disabled={busy} onClick={() => setElsewhere(true)}>
              Send somewhere else
            </button>
          </p>
        )}

        {said ? <p className="t-doc">{said}</p> : null}
      </div>
    </div>
  );
}
