import type { Battlecard, Claim, Competitor } from "../../../../Agents/Competitor Tracker/src/types";
import type { Side } from "@/tools/competitor-tracker/stages";
import Tabs from "./tabs";

type Stored = Battlecard & { standing?: { winning: Side[]; losing: Side[] } };

const AREAS = [
  { key: "pricing", label: "Pricing & packaging" },
  { key: "channels", label: "Marketing & channels" },
  { key: "reviews", label: "Reviews & reputation" },
  { key: "blindspots", label: "Service blind spots" },
] as const;

/**
 * The battlecard, as designed.
 *
 * Every number on this page came off a page we read, and carries the address
 * and the date. That is not decoration: a claim nobody can check is a claim
 * nobody believes, and this product's whole argument is that it does not make
 * things up.
 */
export default function BattlecardView({
  card,
  nextCheck,
}: {
  card: Stored;
  nextCheck: string;
}) {
  const ran = new Date(card.ranAt);
  const you = card.competitors[0];
  const rest = card.competitors.slice(1);

  return (
    <>
      <div className="strip">
        <strong>
          Checked{" "}
          {ran.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </strong>
        <span>
          We look once a week, so this is the same answer you will see all week.
        </span>
        <span className="t-meta">{nextCheck}</span>
      </div>

      {(card.standing?.winning?.length || card.standing?.losing?.length) && (
        <div className="pair">
          <Column
            tone="good"
            label="Ahead"
            heading="Where you are winning"
            items={card.standing?.winning ?? []}
          />
          <Column
            tone="bad"
            label="Behind"
            heading="Where they are winning"
            items={card.standing?.losing ?? []}
          />
        </div>
      )}

      <Tabs
        tabs={AREAS.map((area) => ({
          id: area.key,
          label: area.label,
          panel: (
            <Area
              area={area.key}
              you={you}
              rest={rest}
              label={area.label}
            />
          ),
        }))}
      />

      <h2 className="t-section">Do these three, in this order</h2>
      <p className="t-doc-sm u-wide">
        Each one comes from what we read, not from what we think. Open any of
        them to see exactly what it rests on.
      </p>

      <div className="actions">
        {card.actions.map((action) => (
          <article className="action" key={action.rank}>
            <span className="action__no">{action.rank}</span>
            <div>
              <span className="t-kind action__area">
                {AREAS.find((a) => a.key === action.area)?.label ?? action.area}
              </span>
              <h3 className="t-sub">{action.headline}</h3>
              <p className="action__why t-doc u-wide">{action.why}</p>

              {action.deferred && (
                <p className="t-meta">
                  <span className="tag tag--cant">We cannot</span>
                  {action.deferred}
                </p>
              )}

              {/* Collapsed. They see the point, and open it if they want to
                  argue with it. An argument is what evidence is for. */}
              <details>
                <summary className="t-meta">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  What this is based on
                </summary>
                <ul className="action__ev">
                  {action.evidence.map((claim, i) => (
                    <li key={i}>
                      {claim.text}
                      {claim.source && (
                        <span className="cell-note">
                          {host(claim.source.url)} &middot; {day(claim.source.fetchedOn)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </article>
        ))}
      </div>

      <h2 className="t-section">What we looked at</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Page</th>
              <th>Read</th>
            </tr>
          </thead>
          <tbody>
            {card.sources.map((s) => (
              <tr key={s.url}>
                <td>{s.url}</td>
                <td>{day(s.fetchedOn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {card.unreadable.length > 0 && (
        <>
          <h3 className="t-sub">What we could not read</h3>
          <ul className="cell-list">
            {card.unreadable.map((u, i) => (
              <li key={i}>
                <span className="tag tag--cant">We cannot</span>
                {u.name}
                <span className="cell-note">{WHY[u.reason] ?? u.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="t-meta">
        A blank on this page always means one of those two things, never that
        there was nothing to find.
      </p>
    </>
  );
}

const WHY: Record<string, string> = {
  forbidden: "Their site refused us, and we do not work around a block",
  "not-found": "That page is not there, or the address does not resolve",
  timeout: "Their site did not answer in time",
  "robots-disallowed": "Their robots.txt asks us not to read it",
  "empty-body": "The page came back with nothing in it",
  "needs-login": "It is behind a login, and we never sign in to anything",
  "cost-cap": "We stopped to keep the run inside its budget",
};

function Column({
  tone,
  label,
  heading,
  items,
}: {
  tone: "good" | "bad";
  label: string;
  heading: string;
  items: Side[];
}) {
  return (
    <div className="pair__col">
      <h3 className="t-card card__head">
        {/* The colour never travels alone: the word is always beside it. */}
        <span className={`t-kind kind--${tone} kind--block`}>{label}</span>
        {heading}
      </h3>
      {items.length ? (
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              {item.point}
              <span className="note">{item.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          <li>
            <span className="cell-none">Nothing we can show from what we read</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function Area({
  area,
  you,
  rest,
  label,
}: {
  area: (typeof AREAS)[number]["key"];
  you?: Competitor;
  rest: Competitor[];
  label: string;
}) {
  const all = [you, ...rest].filter(Boolean) as Competitor[];
  const anything = all.some((c) => (c.claims[area]?.length ?? 0) > 0);

  if (!anything) {
    return (
      <div className="panel">
        <h3 className="t-sub">Nothing on {label.toLowerCase()} yet.</h3>
        <p className="t-doc">
          None of the pages we read said anything about this. That is a result
          rather than a gap: it is not published, so nobody choosing between you
          can see it either.
        </p>
      </div>
    );
  }

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>What we found</th>
          </tr>
        </thead>
        <tbody>
          {all.map((c, i) => (
            <tr key={c.name} className={i === 0 ? "row-you" : undefined}>
              <td>
                <strong>{i === 0 ? "You" : c.name}</strong>
                {i === 0 && <span className="cell-note">{c.name}</span>}
              </td>
              <td>
                <ClaimList claims={c.claims[area] ?? []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaimList({ claims }: { claims: Claim[] }) {
  if (!claims.length) {
    return <span className="cell-none">Nothing published that we could read</span>;
  }
  return (
    <ul className="cell-list">
      {claims.map((claim, i) => (
        <li key={i} className={claim.value === null ? "is-no" : undefined}>
          {claim.text}
          {claim.source && (
            <span className="cell-note">
              {host(claim.source.url)} &middot; {day(claim.source.fetchedOn)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
