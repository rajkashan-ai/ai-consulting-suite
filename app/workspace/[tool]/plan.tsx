import type { DocumentBody } from "@/tools/content-social-planner/document";
import { isWrittenPost } from "@/tools/content-social-planner/stages";
import Resizer from "./resizer";
import SendWeek from "./send-week";
import PostControls, { type PostState } from "./post-controls";
import { CadenceChoice, VoiceCorrections } from "./plan-controls";
import { CADENCE_LABEL, CHANNEL } from "../../../../Agents/Content & Social Planner/src/types";

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

const day = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

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
    return url;
  }
};

/** The blanks the owner fills, marked where they are. */
function Words({ words }: { words: string }) {
  const parts = words.split(/(\[[^\]]+\])/g);
  return (
    <p className="t-doc">
      {parts.map((part, i) =>
        part.startsWith("[") && part.endsWith("]") ? (
          <span className="blank" key={i}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export default function PlanView({
  plan,
  nextPlan,
  workspaceId,
  postState,
  corrections,
}: {
  plan: DocumentBody;
  nextPlan: string;
  workspaceId: string;
  /** What the owner has already done to each post, keyed date|channel. */
  postState: Record<string, PostState>;
  /** Corrections they have made to how we write for them. */
  corrections: string[];
}) {
  const written = plan.posts.filter(isWrittenPost);
  const blanks = written.flatMap((p) => p.words.match(/\[[^\]]+\]/g) ?? []);
  const ahead = plan.weeks.slice(1);
  const posted = plan.posts.filter((p) => postState[`${p.date}|${p.channel}`]?.postedAt).length;
  const last = plan.posts.map((p) => p.date).sort().pop();

  return (
    <>
      {/* ── 1. Where they are, before anything they can do ─────────────── */}
      <Band mod="band--a band--first">
        <div className="strip">
          <strong>{plan.posts.length} posts to {last ? day(last) : "the end of the month"}</strong>
          <span>Written from your own pages.</span>
          <span className="t-meta">{nextPlan}</span>
        </div>

        {/* One counted line, read off the plan. Nothing here is generated, for
            the same reason nothing else on the page is: a sentence nobody can
            check is a sentence nobody believes. */}
        <div className="summary">
          <p className="t-lead summary__said">
            {written.length} written and ready.{" "}
            {blanks.length
              ? `${blanks.length} ${blanks.length === 1 ? "needs a line" : "need a line"} from you.`
              : "Nothing needed from you."}
          </p>
          <p className="t-meta">{CADENCE_LABEL[plan.cadence]}, across {plan.channels.map((c) => CHANNEL[c].label).join(" and ")}.</p>
        </div>

        <div className="kpis">
          <div className="kpi kpi--win">
            <span className="kpi__n">{written.length}</span>
            <span className="kpi__w">ready to post</span>
            <span className="kpi__s">Written from your own pages</span>
          </div>
          <div className="kpi">
            <span className="kpi__n">{blanks.length}</span>
            <span className="kpi__w">{blanks.length === 1 ? "line from you" : "lines from you"}</span>
            <span className="kpi__s">Each one says what to put in it</span>
          </div>
          <div className="kpi">
            <span className="kpi__n">{plan.posts.length}</span>
            <span className="kpi__w">planned this month</span>
            <span className="kpi__s">{CADENCE_LABEL[plan.cadence]}</span>
          </div>
        </div>

        <h2 className="t-section">What you have posted</h2>
        <p className="t-doc-sm">Paste the link when a post goes out and we keep the count.</p>
        <div className="card">
          <ul>
            {plan.channels.map((c) => {
              const done = plan.posts.filter(
                (p) => p.channel === c && postState[`${p.date}|${c}`]?.postedAt,
              ).length;
              const lastOn = plan.posts
                .filter((p) => p.channel === c && postState[`${p.date}|${c}`]?.postedAt)
                .map((p) => p.date)
                .sort()
                .pop();
              return (
                <li key={c}>
                  <span className="tag tag--did">{done}</span>
                  <strong>{CHANNEL[c].label}</strong>
                  {done ? ` through here${lastOn ? `, last on ${day(lastOn)}` : ""}.` : " Nothing through here yet."}
                  <span className="note">
                    We cannot see the rest of your account. Connecting one is not built yet, so how a
                    post did is something you can see and we cannot.
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Band>

      {/* ── 2. The two things they can change about how we write ────────── */}
      <Band mod="band--b">
        <h2 className="t-section">How often we suggest you post</h2>
        <p className="t-doc-sm">You can change this, and the whole month is written to the new number.</p>
        <div className="card">
          <h3 className="t-card card__head">{CADENCE_LABEL[plan.recommendation.cadence]}</h3>
          <ul>
            {plan.recommendation.because.map((r, i) => (
              <li key={i}>{r.text}</li>
            ))}
          </ul>
        </div>
        <CadenceChoice workspaceId={workspaceId} current={plan.cadence} />

        <h2 className="t-section">What you sound like</h2>
        <p className="t-doc-sm">
          Read off {plan.voice.source ? host(plan.voice.source.url) : "your own pages"}
          {plan.voice.source ? `, ${plan.voice.source.fetchedOn}` : ""}.
        </p>
        <div className="panel">
          <p className="t-doc">{plan.voice.words}</p>
        </div>
        <VoiceCorrections workspaceId={workspaceId} chosen={corrections} />
      </Band>

      {/* ── 3. What they came for. The one dark band on the screen. ─────── */}
      <Band mod="band--dark">
        <h2 className="t-section">This week</h2>
        <p className="t-doc-sm">
          The days are a suggestion. A day later is fine, and nothing here is ever late.
        </p>
        <div className="posts" id="this-week">
          {written.map((p) => (
            <article className="card" key={p.date}>
              <div className="card__head card__head--base">
                <span className="t-card">{day(p.date)}</span>
                <span className="t-meta">{CHANNEL[p.channel].label}</span>
                <span className="t-kind">{p.purpose}</span>
              </div>
              <div className="card__body">
                {p.title ? (
                  <div className="inset">
                    <p className="t-kind">Title</p>
                    <p className="t-row">{p.title}</p>
                  </div>
                ) : null}
                <Words words={p.words} />
                <div className="inset">
                  <p className="t-kind">{CHANNEL[p.channel].medium === "video" ? "Film" : "Photograph"}</p>
                  <p className="t-row">{p.shot}</p>
                </div>
                <p className="t-meta">{p.why}</p>
              </div>
              <PostControls
                workspaceId={workspaceId}
                postDate={p.date}
                channel={p.channel}
                state={postState[`${p.date}|${p.channel}`] ?? {}}
              />
            </article>
          ))}
        </div>
        <SendWeek />
      </Band>

      {/* ── 4. Reading stops, doing starts. Its own ground says so. ─────── */}
      <Band mod="band--a" id="resize-a-photo">
        <Resizer />
      </Band>

      {/* ── 5. What is coming, and what is not ──────────────────────────── */}
      <Band mod="band--b band--last">
        <h2 className="t-section">The rest of the month</h2>
        <p className="t-doc-sm">
          Every day and channel is already set. The words arrive at the start of each week.
        </p>
        <div className="card">
          <ul className="feed">
            {ahead.map((w) => (
              <li className="feed__row feed__row--static" key={w.week}>
                <span className="t-kind">Ahead</span>
                <span className="t-row t-strong">{w.week}</span>
                <span className="t-meta">
                  {w.posts} {w.posts === 1 ? "post" : "posts"} &middot;{" "}
                  {w.channels.map((c) => CHANNEL[c].label).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <h2 className="t-section">What we did not write</h2>
        <div className="card">
          <h3 className="t-card card__head">Not written, and why</h3>
          <ul>
            {plan.dropped.length ? (
              plan.dropped.map((d, i) => (
                <li key={i}>
                  <span className="tag tag--cant">We cannot</span>
                  {day(d.what)}
                  <span className="note">we left it out because {d.why}</span>
                </li>
              ))
            ) : (
              <li>
                <span className="tag tag--did">Nothing</span>
                Everything we wrote is backed by your own pages
                <span className="note">
                  A gap with no reason beside it reads as a shrug, so this stays here even when it
                  is empty
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Said once, at the end. Every post carrying its own address was
            thirty repetitions of the same line in the Tracker's first table,
            and the rule that came out of it is that repeated support moves to
            a footer rather than going away: CLAUDE.md 1.4a. */}
        <p className="t-meta">
          Every post above was written from your own pages:{" "}
          {plan.pages.map((p) => host(p.url)).join(", ")}, read{" "}
          {plan.pages[0]?.fetchedOn ?? ""}.
        </p>
      </Band>
    </>
  );
}
