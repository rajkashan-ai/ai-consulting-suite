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

  return (
    <>
      {/* What has gone out, first, because it is the question an owner opens
          this on: not "what should I post" but "am I keeping it up". The count
          says which count it is, because posts through this tool and posts on
          their account are two numbers and showing the first as the second
          tells a barber of four years they have posted twice. */}
      <h2 className="t-sub">What you have posted</h2>
      <p className="t-doc-sm">
        Paste the link when a post goes out and we keep the count.
      </p>
      <div className="card">
        <ul className="rows">
          {plan.channels.map((c) => {
            const done = plan.posts.filter(
              (p) => p.channel === c && postState[`${p.date}|${c}`]?.postedAt,
            ).length;
            const last = plan.posts
              .filter((p) => p.channel === c && postState[`${p.date}|${c}`]?.postedAt)
              .map((p) => p.date)
              .sort()
              .pop();
            return (
              <li className="t-row" key={c}>
                <strong>{CHANNEL[c].label}</strong>{" "}
                {done
                  ? `${done} through here${last ? `, last on ${day(last)}` : ""}.`
                  : "Nothing through here yet."}{" "}
                <span className="note">
                  We cannot see the rest of your account. Connecting one is not built yet, so how a
                  post did is something you can see and we cannot.
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The figures, and each one says which count it is. "2 blanks" and
          "2 posts" are different things and an owner reading the wrong one
          plans their week around it. */}
      <div className="kpis">
        <div className="kpi kpi--win">
          <span className="kpi__n">{written.length}</span>
          <span className="kpi__w">ready to post</span>
          <span className="kpi__s">Written from your own pages</span>
        </div>
        <div className={blanks.length ? "kpi kpi--gap" : "kpi"}>
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

      <h2 className="t-sub">How often we suggest you post</h2>
      <div className="panel">
        <p className="t-doc">
          <strong>{CADENCE_LABEL[plan.recommendation.cadence]}.</strong>
        </p>
        <ul className="rows">
          {plan.recommendation.because.map((r, i) => (
            <li className="t-row" key={i}>
              {r.text}
            </li>
          ))}
        </ul>
      </div>
      <p className="t-doc-sm">You can change this, and the whole month is written to the new number.</p>
      <CadenceChoice workspaceId={workspaceId} current={plan.cadence} />

      <h2 className="t-sub">What you sound like</h2>
      {/* Where it came from, said here rather than only in the footer. Raj
          asked "what is this based on?" of the first live run, which is the
          question anything on this page has to be able to answer. */}
      <p className="t-doc-sm">
        Read off {plan.voice.source ? host(plan.voice.source.url) : "your own pages"}
        {plan.voice.source ? `, ${plan.voice.source.fetchedOn}` : ""}.
      </p>
      <div className="panel">
        <p className="t-doc">{plan.voice.words}</p>
      </div>
      <VoiceCorrections workspaceId={workspaceId} chosen={corrections} />

      <h2 className="t-sub">This week</h2>
      <p className="t-doc-sm">
        The days are a suggestion. A day later is fine, and nothing here is ever late.
      </p>
      <div className="posts" id="this-week">
        {written.map((p) => (
          <article className="card" key={p.date}>
            <div className="card__head card__head--base">
              <span className="t-card">{day(p.date)}</span>
              <span className="t-meta">{CHANNEL[p.channel].label}</span>
              <span className="tag tag--info">{p.purpose}</span>
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
              words={p.words}
              state={postState[`${p.date}|${p.channel}`] ?? {}}
            />
          </article>
        ))}
      </div>
      <SendWeek />

      {/* The photo each post asked for, sized for where it is going. It sits
          after the posts because that is the order the owner does it in: read
          the post, take the photo, size it. */}
      <div id="resize-a-photo">
        <Resizer />
      </div>

      <h2 className="t-sub">The rest of the month</h2>
      <p className="t-doc-sm">
        Every day and channel is already set. The words arrive at the start of each week.
      </p>
      <ul className="rows">
        {ahead.map((w) => (
          <li className="t-row" key={w.week}>
            <strong>{w.week}</strong> · {w.posts} {w.posts === 1 ? "post" : "posts"} ·{" "}
            {w.channels.map((c) => CHANNEL[c].label).join(", ")}
          </li>
        ))}
      </ul>

      {/* Always here, even when there is nothing in it. A section that appears
          only on a bad week teaches the reader that its absence means nothing,
          when its absence is the good news. */}
      <h2 className="t-sub">What we did not write</h2>
      {plan.dropped.length ? (
        <>
          <p className="t-doc-sm">
            A gap with no reason beside it reads as a shrug, so here is the reason.
          </p>
          <ul className="rows">
            {plan.dropped.map((d, i) => (
              <li className="t-row" key={i}>
                <strong>{day(d.what)}</strong> · we left it out because {d.why}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="t-doc-sm">
          Nothing. Everything we wrote this week is backed by something on your own pages.
        </p>
      )}

      {/* Said once, at the end. Every post carrying its own address was thirty
          repetitions of the same line in the Tracker's first table, and the
          rule that came out of it is that repeated support moves to a footer
          rather than going away: CLAUDE.md 1.4a. */}
      <p className="t-meta">
        Every post above was written from your own pages:{" "}
        {plan.pages.map((p) => host(p.url)).join(", ")}, read{" "}
        {plan.pages[0]?.fetchedOn ?? ""}. {nextPlan}
      </p>
    </>
  );
}
