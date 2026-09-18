import type { DocumentBody } from "@/tools/content-social-planner/document";
import Make from "./make";
import Made, { type MadePost } from "./made";
import SendPosts from "./send-posts";
import BrandPersona from "./persona";
import type { Persona, StyleId } from "@/tools/content-social-planner/persona";
import { isWrittenPost } from "@/tools/content-social-planner/stages";
import Resizer from "./resizer";
import { CHANNEL } from "../../../../Agents/Content & Social Planner/src/types";

/**
 * A month of posts, as designed.
 *
 * Every post on this page was written off a page we read, and carries where it
 * came from. That is not decoration: this tool writes what the owner publishes
 * under their own name, so a claim nobody can check is a claim that becomes
 * their problem and not ours.
 *
 * Read `Agents/Content & Social Planner/CLAUDE.md` 3 for what belongs here and
 * in what order. The sections are a contract, not a layout preference: one went
 * missing once and no test noticed.
 */

/** One band, with its inner column. The only landmark this system gives. */
function Band({ mod, id, children }: { mod: string; id?: string; children: React.ReactNode }) {
  return (
    <div className={`band ${mod}`} id={id}>
      <div className="band__in">{children}</div>
    </div>
  );
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, "");
  } catch {
    // Not a url we can parse. Expected: these come off pages we did not
    // write, and showing the raw string is the right answer.
    return url;
  }
};

export default function PlanView({
  plan,
  workspaceId,
  made,
  services,
  knownEmail,
  voice,
}: {
  plan: DocumentBody;
  workspaceId: string;
  /** Posts they asked for on the day, newest first. See Made. */
  made: MadePost[];
  /** Their own services, off their own site, for the notes hint. See Make. */
  services: { name: string; price?: string | null }[];
  /** The address they signed in with, so we do not ask for one we have. */
  knownEmail: string | null;
  /** How they sound, and the voice they chose. See BrandPersona. */
  voice: {
    persona: Persona | null;
    style: StyleId;
    samples: string[];
    inspiration: string | null;
  };
}) {
  /**
   * Every week, with this one marked. It used to slice(1), which dropped the
   * week they are actually in and labelled the rest "Ahead", so the section
   * meant to show the shape of the month showed four fifths of it and said
   * nothing about where they were standing.
   */
  const thisWeek = plan.posts.find((p) => isWrittenPost(p))?.week ?? 1;

  return (
    <>
      {/* ── 1. How they sound, before anything written in it ─────────────
          First on the page because everything below is written in this voice.
          It used to be two sentences near the bottom, described and never
          offered, and then a section called "What you sound like" that said it
          back without letting them change it. That went on 2026-09-18. */}
      <Band mod="band--a band--first">
        <BrandPersona
          workspaceId={workspaceId}
          persona={voice.persona}
          style={voice.style}
          samples={voice.samples}
          inspiration={voice.inspiration}
        />
      </Band>

      {/* ── 2. What they came for ────────────────────────────────────────
          A calendar they did not ask for produces guilt; this is triggered by
          something real happening.

          It is NOT the dark band, and that was tried. `.band--dark` puts back
          the ink colour inside `.card` and `.action` but not inside `.panel`,
          which is what these two are, so every line of every post rendered
          white on cream and the screen was unreadable. Giving this band the
          dark ground is a design job, not a class swap: there is no section
          designed for it now that the written week has gone. */}
      <Band mod="band--a">
        <Make workspaceId={workspaceId} services={services} />
        <Made made={made} />
        {/* Under the posts, because it is what you do once there are some. */}
        {made.length ? <SendPosts workspaceId={workspaceId} knownEmail={knownEmail} /> : null}
      </Band>

      {/* ── 4. Reading stops, doing starts. Its own ground says so. ─────── */}
      <Band mod="band--a" id="resize-a-photo">
        <Resizer />
      </Band>

      {/* ── 5. What is coming ────────────────────────────────────────────── */}
      <Band mod="band--b band--last">
        <h2 className="t-section">The rest of the month</h2>
        <p className="t-doc-sm">
          The shape of the month, so a blank Tuesday has somewhere to start.
          Write any of them whenever you like, up above.
        </p>
        <div className="card">
          <ul className="feed">
            {plan.weeks.map((w, i) => (
              <li
                /* Marked by its label, which is how the mockup does it and
                   needs no class that does not exist. aria-current carries the
                   same fact to a reader who cannot see the column. */
                className="feed__row feed__row--static"
                key={w.week}
                aria-current={i + 1 === thisWeek ? "true" : undefined}
              >
                <span className="t-kind">{i + 1 === thisWeek ? "This week" : "Ahead"}</span>
                <span className="t-row t-strong">{w.week}</span>
                <span className="t-meta">
                  {w.posts} {w.posts === 1 ? "post" : "posts"} &middot;{" "}
                  {w.channels.map((c) => CHANNEL[c].label).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Said once, at the end. Every post carrying its own address was
            thirty repetitions of the same line in the Tracker's first table,
            and the rule that came out of it is that repeated support moves to
            a footer rather than going away: CLAUDE.md 1.4a. */}
        <p className="t-meta receipt">
          Every post above was written from your own pages:{" "}
          {plan.pages.map((p) => host(p.url)).join(", ")}, read{" "}
          {plan.pages[0]?.fetchedOn ?? ""}.
        </p>
      </Band>
    </>
  );
}
