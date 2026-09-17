import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EVERY,
  GENERAL,
  NO_PUBLIC_PRICES,
  SPECIALIST,
  asRows,
  coverage,
  tradesCovered,
} from "../tools/sources/uk-directories.ts";

/**
 * Write PLAYBOOK-SOURCES.md from the source list.
 *
 * The first version of that report was typed out beside the data rather than
 * generated from it, and within a day it was telling readers that two
 * dog-walking sites covered all 100 trades and that a bars-and-venues site
 * priced florists. The data was wrong too, but the report being separate is
 * what let it be published and checked by someone else before anyone noticed.
 *
 * Run: npm run playbook-sources
 */

const ALL = [...GENERAL, ...SPECIALIST];
const today = new Date().toISOString().slice(0, 10);

const reachable = (d: (typeof ALL)[number]) =>
  d.reachable.state === "yes"
    ? `readable, ${d.reachable.checked}`
    : d.reachable.state === "blocked"
      ? `blocked (${d.reachable.how})`
      : "untested";

const claims = (d: (typeof ALL)[number]) =>
  d.covers.includes(EVERY) ? "every trade" : String(tradesCovered(d).length);

const c = coverage();
const readable = ALL.filter((d) => d.reachable.state === "yes").length;
const blocked = ALL.filter((d) => d.reachable.state === "blocked").length;
const untested = ALL.filter((d) => d.reachable.state === "untested").length;

const out = `# Competitor price sources by UK trade

Generated ${today} from web/tools/sources/uk-directories.ts. Do not edit by
hand: run \`npm run playbook-sources\`.

**For checking by someone who did not build this.** Every source was fetched
before it was written down. "Readable" means its robots.txt returned a real
response to our reader; it does not mean a listing page has been read, which is
a separate and harder claim we have only made for Booksy, Fresha and the Food
Standards Agency.

A source covers the trades it actually lists. Where it covers a whole group,
the group is named and the reason is in the code, because tagging by group is
what once had a dog-walking site covering vets.

- Trades: **${c.trades}**
- Price comparison possible: **${c.canComparePrices}**
- Not possible: **${c.trades - c.canComparePrices}**
- Trades with a specialist source: **${c.withSpecialist}** (the rest have the general floor only)
- Sources: **${ALL.length}** (${readable} readable, ${blocked} blocked, ${untested} untested)

## Where no public prices exist

Confirmed by three independent research passes. In each case the reason is how
the trade prices its work, not a gap in our searching.

| Group | Why |
|---|---|
${NO_PUBLIC_PRICES.map((n) => `| ${n.group} | ${n.why} |`).join("\n")}

## Every trade

| Trade | Group | Prices? | Price sources | Other sources |
|---|---|---|---|---|
${asRows()
  .map(
    (r) =>
      `| ${r.trade} | ${r.group} | ${r.canComparePrices ? "**yes**" : "no"} | ` +
      `${r.priceSources.join(", ") || "—"} | ${r.otherSources.join(", ") || "—"} |`,
  )
  .join("\n")}

## Every source

| Source | Host | Reachable | Carries | Trades claimed | Claim came from |
|---|---|---|---|---|---|
${ALL.map(
  (d) =>
    `| ${d.name} | ${d.host} | ${reachable(d)} | ${d.carries.join(", ")} | ` +
    `${claims(d)} | ${d.source} |`,
).join("\n")}

## How to check this

1. **A source we call readable**: fetch \`https://<host>/robots.txt\` and see if
   a real file comes back rather than a challenge page.
2. **A source we call blocked**: the same, and expect the failure named.
3. **A price claim**: open the source's own listing page for a trade and town and
   look for a price beside a business name. If there is none, the row is wrong.
4. **A trade claim**: open the source and search for that trade. A source listed
   against a trade it does not carry is the failure this report had on its first
   publication.
5. **A "no prices exist" claim**: the strongest claim here and the one most worth
   attacking. One UK site publishing plumber rates by town disproves it.
`;

const path = join(import.meta.dirname, "../../PLAYBOOK-SOURCES.md");
writeFileSync(path, out);
console.log(`${path}: ${c.trades} trades, ${ALL.length} sources`);
