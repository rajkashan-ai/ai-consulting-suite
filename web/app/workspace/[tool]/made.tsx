import { INTENTS, type Intent } from "@/tools/content-social-planner/paths";
import { creditLine } from "@/tools/content-social-planner/sources";
import DeletePost from "./delete-post";

export type MadePost = {
  id: string;
  path: string;
  intent: string | null;
  thought: string | null;
  words: string;
  shot: string | null;
  why: string | null;
  source_url: string;
  source_on: string | null;
  from_photo: boolean;
  photo_on: string | null;
  service: string | null;
  made_at: string;
};

/**
 * Posts they asked for, newest first.
 *
 * Written the day the asking was built, because without it a post could be
 * made and never seen: the action saved it and nothing read the table. The
 * feature was half there and the tests did not notice, because every one of
 * them checked the asking and none checked the showing.
 *
 * Above the month rather than mixed into it. These have no slot and no date we
 * chose: they exist because somebody asked at four on a Tuesday, and putting
 * them in a calendar row would be inventing a schedule they did not agree to.
 */
export default function Made({ made }: { made: MadePost[] }) {
  if (!made.length) return null;

  const label = (id: string | null) =>
    INTENTS.find((i) => i.id === (id as Intent))?.label ?? null;

  const when = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="panel">
      <h2 className="t-sub">
        {made.length === 1 ? "The post you made" : `${made.length} posts you made`}
      </h2>

      <div className="picks">
        {made.map((p) => (
          <div className="pick" key={p.id}>
            <span className="pick__body">
              <span className="pick__head">
                {label(p.intent) ? <span className="tag tag--info">{label(p.intent)}</span> : null}
                <span className="pick__where">{when(p.made_at)}</span>
              </span>

              {/* Their own words first, when there were any. It is why the post
                  says what it says, and they should not have to remember. */}
              {p.thought ? <span className="pick__reads">You said: {p.thought}</span> : null}

              <span className="t-doc made__words">{p.words}</span>

              {p.shot ? <span className="pick__where">Photograph: {p.shot}</span> : null}
              {p.why ? <span className="pick__reads">{p.why}</span> : null}

              {/* Where it came from, said once, at the bottom. A claim nobody
                  can check is a claim nobody believes, and a claim pointed at
                  the wrong source is worse: it looks checked. A post written
                  from a photo says so, because no page of theirs describes the
                  work in it. */}
              <span className="t-micro receipt">
                {creditLine(p.from_photo, p.source_on, p.photo_on)}
              </span>

              {/* Beside where it came from, at the bottom, because throwing one
                  away is the last thing you do with it and not the first. */}
              <DeletePost id={p.id} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
