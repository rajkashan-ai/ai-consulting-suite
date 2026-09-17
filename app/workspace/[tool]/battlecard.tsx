import type { Battlecard, Claim, Competitor } from "../../../../Agents/Competitor Tracker/src/types";
import { groupNotChecked } from "@/tools/competitor-tracker/coverage";
import { gapReads } from "@/tools/competitor-tracker/rankActions";
import { funnelReads } from "@/tools/competitor-tracker/shortfall";
import type { DocumentBody } from "@/tools/competitor-tracker/document";
import type { Grid, Side } from "@/tools/competitor-tracker/stages";
import Tabs from "./tabs";
import Mark, { CopyEverything } from "./mark";

/**
 * Two definitions of the same thing had drifted apart: this one and
 * DocumentBody in tools/competitor-tracker/document.ts, which is what actually
 * gets written. The two lines explaining a short comparison were added there
 * and never here, so they were stored on every run and shown on none.
 */
type Stored = DocumentBody;

/** "a, b and c". A trailing comma before "and" reads as a list, not a sentence. */
function asList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

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
  workspaceId,
  documentId,
  runId,
}: {
  card: Stored;
  nextCheck: string;
  workspaceId: string;
  documentId: string | null;
  runId: string | null;
}) {
  const mark = (target: string, said: string) => (
    <Mark
      workspaceId={workspaceId}
      documentId={documentId}
      runId={runId}
      target={target}
      said={said}
    />
  );
  const ran = new Date(card.ranAt);

  /**
   * Whose page each address was.
   *
   * Taken from the grid rather than stored alongside the source, so it works on
   * every battlecard already saved and needs no new run to be useful. A cell
   * sits in a column, the column is a business, and the cell carries the
   * address its fact came from.
   *
   * A page nobody's column cites is a town listing, which belongs to everybody
   * and is named as such rather than guessed at.
   */
  const owners = new Map<string, string>();
  for (const g of card.grid ?? []) {
    for (const row of g.rows ?? []) {
      for (const [i, cell] of (row.cells ?? []).entries()) {
        const url = cell?.source?.url;
        if (url && g.columns?.[i] && !owners.has(url)) owners.set(url, g.columns[i]);
      }
    }
  }
  const whose = (url: string) => owners.get(url) ?? null;

  /**
   * The three figures at the top, counted off what the card already holds.
   *
   * Nothing here is generated and nothing is new: the price comes out of the
   * grid, the businesses found out of the funnel, the review count out of the
   * reviews rows. The measured fault was sixteen numbers on this page all
   * rendered at body size, so the page had no hierarchy and no amount of
   * shadow or radius would have given it one.
   *
   * A figure that cannot be counted is not shown. Three is the most that can
   * be read at a glance, and two is fine.
   */
  const pricing = card.grid?.find((g) => g.area === "pricing");
  const yourPrice = pricing?.rows?.find((r) => r.cells?.[0]?.value)?.cells?.[0]?.value ?? null;

  const reviewRow = card.grid
    ?.find((g) => g.area === "reviews")
    ?.rows?.find((r) => /review/i.test(r.attribute));
  const theirReviews = (reviewRow?.cells ?? [])
    .slice(1)
    .map((c) => Number(String(c?.value ?? "").replace(/[^\d]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  const figures: { n: string; what: string; sub?: string; tone?: "gap" | "win" }[] = [];

  if (yourPrice) {
    figures.push({
      n: yourPrice,
      what: "What you charge for the first thing on your price list",
      sub: `Compared with ${card.competitors.length} others near you`,
      tone: "gap",
    });
  }
  if (card.funnel?.found) {
    figures.push({
      n: String(card.funnel.found),
      what: `${card.business ? "Businesses" : "Businesses"} we found before narrowing`,
      sub: `Compared the ${card.competitors.length} closest to you`,
      tone: "win",
    });
  }
  if (theirReviews.length) {
    const total = theirReviews.reduce((a, b) => a + b, 0);
    figures.push({
      n: total.toLocaleString("en-GB"),
      what: "Public reviews the others carry between them",
      sub: `Across ${theirReviews.length} of the ${card.competitors.length} compared`,
    });
  }

  const areasRead = AREAS.filter((a) =>
    card.grid?.some((g) => g.area === a.key && g.rows.length > 0),
  ).map((a) => a.label.toLowerCase());

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

      {/* Named the way the tabs name them, and only the ones that were built.
          Naming an area the run could not produce would be the summary
          promising something the page does not have. */}
      {/* What this page is, before the first finding assumes you know.
          The first line an owner read began "You publish 5 prices", and
          nothing had yet said what 5 was or who they were.

          Two lines doing two jobs. The headline is written and is dropped if
          it cannot be stood behind, so it is absent rather than wrong. The line
          under it is fixed text with the counts slotted in, so whatever happens
          the reader is still told what was compared. */}
      <div className="summary">
        {card.headline && <p className="t-lead summary__said">{card.headline}</p>}
        <p className="t-meta">
          We compared you with {card.competitors.length}{" "}
          {card.competitors.length === 1 ? "business" : "businesses"} near you
          {areasRead.length > 0 && <> across {asList(areasRead)}</>}.
        </p>
      </div>

      {figures.length > 0 && (
        <div className="kpis">
          {figures.map((f) => (
            <div
              key={f.what}
              className={`kpi${f.tone ? ` kpi--${f.tone}` : ""}`}
            >
              <span className="kpi__n">{f.n}</span>
              <p className="kpi__w">{f.what}</p>
              {f.sub && <span className="kpi__s">{f.sub}</span>}
            </div>
          ))}
        </div>
      )}

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
              grid={card.grid?.find((g) => g.area === area.key)}
              competitors={card.competitors}
              label={area.label}
              mark={mark}
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
              {/* Why this one is first, in a number rather than an adjective.
                  The order is the size of these gaps, largest first, so the
                  reason for the ranking is on the page beside the ranking. */}
              {gapReads(action.gap) && (
                <p className="action__gap t-meta">{gapReads(action.gap)}</p>
              )}
              <p className="action__why t-doc u-wide">{action.why}</p>
              {action.effect && (
                <p className="action__effect t-doc-sm u-wide">{action.effect}</p>
              )}
              {mark(`action:${action.rank}`, `${action.headline} — ${action.why}`)}

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

      {(card.shortfall || card.areas) && (
        <p className="t-meta">
          {[card.shortfall, card.areas].filter(Boolean).join(" ")}
        </p>
      )}

      {/* Two lists, side by side. What we checked, and what we did not and why.
          The right hand one used to be pages that refused us and nothing else,
          so the things we never look at at all were invisible: an owner could
          read the whole page and never learn that we do not do traffic, do not
          do rankings, and will not copy a review. A gap nobody mentions reads
          as a gap nobody noticed. */}
      <div className="checked">
        <section>
          <h2 className="t-section">What we checked</h2>
          {/* The narrowing, before the list of what survived it. The page used
              to show the eight pages we read and nothing else, so a reader
              could not see that thirty two names became five, or that we looked
              at forty eight results to get there. That is the work, and the
              work is most of the reason to believe the answer. */}
          {card.funnel && funnelReads(card.funnel) && (
            <p className="t-meta checked__funnel">{funnelReads(card.funnel)}</p>
          )}
          {/* The same shape as the list beside it, because they are a pair and
              two different formats side by side read as two different things.

              It was a table of raw urls, eighty characters each and wrapped
              over two lines, which is unreadable and answers the wrong
              question: the reader wants to know whose page it was, not what
              its address is. The name leads, the address is underneath and is
              a link, so it can still be checked. */}
          <ul className="cell-list">
            {card.sources.map((s) => (
              <li key={s.url}>
                <span className="tag tag--did">Read</span>
                {whose(s.url) ?? host(s.url)}
                <span className="cell-note">
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                    {host(s.url)}
                  </a>{" "}
                  &middot; {day(s.fetchedOn)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="t-section">What we did not, and why</h2>

          {card.unreadable.length > 0 && (
            <ul className="cell-list">
              {card.unreadable.map((u, i) => (
                <li key={`p${i}`}>
                  <span className="tag tag--cant">Refused us</span>
                  {u.name}
                  <span className="cell-note">{WHY[u.reason] ?? u.reason}</span>
                </li>
              ))}
            </ul>
          )}

          {groupNotChecked().map((group) => (
            <ul className="cell-list" key={group.kind}>
              {group.rows.map((r) => (
                <li key={r.what}>
                  <span className="tag tag--cant">{LABEL[group.kind]}</span>
                  {r.what}
                  <span className="cell-note">{r.why}</span>
                </li>
              ))}
            </ul>
          ))}
        </section>
      </div>

      <p className="t-meta">
        A blank on this page always means one of the things on the right, never
        that there was nothing to find.
      </p>

      {/* Outside the document, structurally, so it can never reach an export of
          the battlecard itself. UI/CLAUDE.md section 7.2. */}
      {runId && <CopyEverything runId={runId} />}
    </>
  );
}

/** The short tag on each row, so the kind is readable at a glance. */
const LABEL: Record<string, string> = {
  "cannot be known": "Nobody can",
  "not allowed": "We will not",
  "not yet": "Not yet",
};

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

/**
 * One area, as a grid.
 *
 * A row is one comparable thing and a column is one business, so "who is
 * cheapest" is a glance along a row. It was a list of bullet points under each
 * name, which meant holding six paragraphs in your head to answer that.
 *
 * The customer is the first column and is never one of the competitors. The old
 * version took competitors[0] as the customer, so once they were correctly
 * removed from that list a competitor's opening hours appeared under "You".
 */
function Area({
  area,
  grid,
  competitors,
  label,
  mark,
}: {
  area: (typeof AREAS)[number]["key"];
  grid?: Grid;
  competitors: Competitor[];
  label: string;
  mark: (target: string, said: string) => React.ReactNode;
}) {
  if (!grid || !grid.rows.length) {
    // Fall back to whatever claims exist, so an older battlecard still reads.
    const anything = competitors.some((c) => (c.claims[area]?.length ?? 0) > 0);
    if (!anything) {
      return (
        <div className="panel">
          <h3 className="t-sub">Nothing on {label.toLowerCase()} yet.</h3>
          <p className="t-doc">
            None of the pages we read said anything about this. That is a result
            rather than a gap: it is not published, so nobody choosing between
            you can see it either.
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
            {competitors.map((c) => (
              <tr key={c.name}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>
                  <ClaimList claims={c.claims[area] ?? []} mark={mark} who={c.name} area={area} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /**
   * Where each column's facts came from, worked out once.
   *
   * Every cell used to print "booksy.com &middot; 15 Sept" under its value:
   * thirty repetitions of the same eight words in one table, and the reader
   * has to look past all of them to compare two numbers. Nielsen's eighth
   * heuristic, almost word for word: interfaces should not contain information
   * that is irrelevant or rarely needed.
   *
   * It is not irrelevant, though, which is why it moves rather than goes. A
   * claim nobody can check is a claim nobody believes. So it is said once,
   * under the business it belongs to, and a cell only speaks up when its source
   * is not the one named above it.
   */
  const usual = grid.columns.map((_, i) => {
    const hosts = grid.rows
      .map((r) => r.cells[i]?.source?.url)
      .filter(Boolean)
      .map((u) => host(u as string));
    if (!hosts.length) return null;
    const counted = new Map<string, number>();
    for (const h of hosts) counted.set(h, (counted.get(h) ?? 0) + 1);
    return [...counted.entries()].sort((a, b) => b[1] - a[1])[0][0];
  });

  return (
    <>
      <div className="tablewrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="grid__what" />
              {grid.columns.map((name, i) => (
                <th key={name} className={i === 0 ? "grid__you" : undefined}>
                  {i === 0 ? "You" : name}
                  {usual[i] && <span className="grid__from">from {usual[i]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.attribute}>
                <th scope="row" className="grid__what">
                  {row.attribute}
                  {mark(`grid:${area}:${row.attribute}`, row.attribute)}
                </th>
                {row.cells.map((cell, i) => {
                  const from = cell.source ? host(cell.source.url) : null;
                  const odd = from && from !== usual[i] ? from : null;
                  return (
                    <td key={i} className={i === 0 ? "grid__you" : undefined}>
                      {cell.value ? (
                        <>
                          <strong className="grid__value">{cell.value}</strong>
                          {cell.note && <span className="grid__qual">{cell.note}</span>}
                          {odd && <span className="grid__qual">{odd}</span>}
                        </>
                      ) : (
                        <span className="cell-none">Not published</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grid.note && <p className="t-meta">{grid.note}</p>}
      <p className="t-meta">
        Every figure here was read on the dates listed at the foot of this page.
      </p>
    </>
  );
}

function ClaimList({
  claims,
  mark,
  who,
  area,
}: {
  claims: Claim[];
  mark?: (target: string, said: string) => React.ReactNode;
  who?: string;
  area?: string;
}) {
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
          {mark && who && area && (
            <span className="cell-note">{mark(`claim:${who}:${area}:${i}`, claim.text)}</span>
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
    // Not a url we can parse. Expected: these come off pages we did not
    // write, and showing the raw string is the right answer.
    return url;
  }
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
