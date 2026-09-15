import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { visibleText } from "../lib/research/text.ts";

/**
 * Faults that have actually happened, each with the date and what it cost.
 *
 * The other test files describe how things should work. This one only contains
 * things that were wrong, in production, on a real business, so that the same
 * afternoon is never spent twice.
 */

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/* ── The prompt and the code disagreeing ─────────────────────────────────── */

test("the prompt does not forbid what the code needs", () => {
  /**
   * 15 September. The code stopped stripping full postcodes so distance could
   * be measured. The prompt still said "Never a full postcode: that locates a
   * household", so the model dutifully returned "37 Smithfield Road, SY1", and
   * the heaviest ranking factor did nothing for another two runs.
   *
   * Nothing type checks a prompt, and nothing ever will. This reads it.
   */
  const detect = read("lib/research/detect.ts");
  assert.ok(
    !/Never a full postcode/i.test(detect),
    "the prompt is telling the model to withhold the postcode distance needs",
  );
  assert.match(detect, /postcode is how we work out/i, "it explains why it wants one");
});

test("a pricing action is told to say what to publish, never what to charge", () => {
  // 15 September. Four cards refused in a row, one for "You do not have to
  // match anyone", where the guard saw the verb "match" near the word "price"
  // and cannot see a negation.
  const stages = read("tools/competitor-tracker/stages.ts");
  assert.match(stages, /never what to charge/i);
  assert.match(stages, /do not have to match anyone/i, "the failing example is kept");
});

test("the writing step is told the five and cannot choose its own", () => {
  // 15 September. Ranking chose NO.1, HINCES, Branded Barbers and Golden
  // Scissors. The card came back about Fade Inn, Darwin's and Barbering AJ.
  const stages = read("tools/competitor-tracker/stages.ts");
  assert.match(stages, /AND NOBODY ELSE/);
  assert.match(stages, /agreed\.size/, "and a filter, because a prompt is only guidance");
});

/* ── Text extraction ─────────────────────────────────────────────────────── */

test("a price list written with HTML entities survives", () => {
  /**
   * 15 September. The Barber Shop's price page writes "&pound;8.00", not "£8".
   * I grepped the raw HTML for "£", found none, and told Raj the prices were
   * unreadable and that it was a limit of the whole approach. They were in the
   * page all along and the fetcher already decoded them correctly.
   */
  const out = visibleText(
    "<p>Clipper Cut &pound;8.00</p><p>Classic Cut &pound;15.00</p>" +
      "<p>Cut &amp; Beard &pound;20.00</p>",
  );
  assert.match(out, /Clipper Cut £8\.00/);
  assert.match(out, /Classic Cut £15\.00/);
  assert.match(out, /Cut & Beard £20\.00/);
});

test("links are kept in round brackets, never angle ones", () => {
  // 15 September. Written as <url> first, which the next line strips because it
  // removes anything shaped like a tag. Every link was silently removed again.
  const out = visibleText('<a href="/venue/x">HINCES</a>', "https://booksy.com");
  assert.match(out, /HINCES \(https:\/\/booksy\.com\/venue\/x\)/);
  assert.ok(!/<https/.test(out));
});

/* ── The database ────────────────────────────────────────────────────────── */

test("a run's cost is added up in the database, never in the app", () => {
  /**
   * 15 September. Each step wrote its token count over the last one, and the
   * final step makes no model calls, so every finished run recorded zero. The
   * page count added to a field nothing has ever written.
   *
   * It has to be one statement in Postgres: the open page and the scheduled
   * tick can both advance a run, and a read-modify-write from two places loses
   * one of them.
   */
  const sql = read("supabase/008_cost.sql");
  assert.match(sql, /input_tokens\s*=\s*input_tokens\s*\+/, "adds, never assigns");
  assert.match(sql, /pages_fetched\s*=\s*pages_fetched\s*\+/);

  const engine = read("lib/engine.ts");
  assert.match(engine, /add_run_cost/, "the engine calls it");
  assert.ok(
    !/input_tokens:\s*spent\.input/.test(engine),
    "the engine is assigning a total again instead of adding to one",
  );
});

test("every policy can be created twice, because every file is run again", () => {
  // 15 September. Postgres has no "create policy if not exists", so npm run db
  // failed on its second run, on the first file, before doing anything.
  for (const f of ["001_schema.sql", "005_playbooks.sql"]) {
    const sql = read(`supabase/${f}`);
    for (const m of sql.matchAll(/create policy\s+("[^"]+")\s*\n?\s*on\s+([\w.]+)/g)) {
      assert.match(
        sql,
        new RegExp(`drop policy if exists ${m[1]} on ${m[2]}`),
        `${f}: ${m[1]} has no drop before it, so a second run fails`,
      );
    }
  }
});

test("the migration runner reads the answer, not the exit code", () => {
  // 15 September. The Supabase CLI exits 0 when the SQL fails. It prints the
  // error and reports success, so every "applied" I reported proved nothing.
  const runner = read("db.mjs");
  assert.match(runner, /_tag":"Error/, "it looks for the error the CLI prints");
  assert.match(runner, /exits 0 when the SQL fails/i, "and says why");
});

/* ── Reaching the web ────────────────────────────────────────────────────── */

test("the fetcher queues on the domain, so one site cannot be hit twice at once", () => {
  // 15 September. It computed the domain with www stripped and then queued on
  // the raw hostname, so www.barber.co.uk and barber.co.uk were two queues onto
  // one machine. Exactly what the rule exists to prevent.
  const fetch = read("lib/research/fetch.ts");
  assert.match(fetch, /queued\(domain,/);
  assert.ok(!/queued\(url\.hostname/.test(fetch));
});

test("a site we could not reach is never reported as a site that refused us", () => {
  // 15 September. /try said "Their robots.txt asks us not to read this page"
  // for a domain that does not resolve. A false claim about somebody else's
  // website, on a page whose whole argument is that it does not make things up.
  const fetch = read("lib/research/fetch.ts");
  assert.match(fetch, /rules\.reachable/);
  assert.match(fetch, /We could not reach/);
});

test("the sitemap parser copes with the tags already being stripped", () => {
  // 15 September. It read the sitemap fine, found nothing in it every time, and
  // fell back to guessing paths as though the site had none.
  const sitemap = read("lib/research/sitemap.ts");
  assert.match(sitemap, /tags were stripped|tags already/i);
});

/* ── Getting in ──────────────────────────────────────────────────────────── */

test("the no-email sign-in still cannot exist on a deployed site", () => {
  // It hands out a real session. Three refusals, because one is a single
  // careless edit from being gone.
  for (const f of ["app/api/dev-signin/route.ts", "app/sign-in/page.tsx"]) {
    const text = read(f);
    assert.match(text, /NODE_ENV [!=]== "production"/, f);
    assert.match(text, /process\.env\.VERCEL/, f);
    assert.match(text, /ALLOW_DEV_SIGNIN/, f);
  }
});

test("the code box can be reached without sending an email", () => {
  // 15 September. Rate limited, and the only route to the code box was the one
  // action that had just been refused. A dead end built from two reasonable
  // decisions.
  assert.match(read("app/sign-in/form.tsx"), /I already have a code/);
});

/* ── What the guards are handed ──────────────────────────────────────────── */

test("every line handed to the guards ends in a full stop", async () => {
  /**
   * 15 September, and it cost four failed runs.
   *
   * The guards split text into sentences at a full stop. Claims do not end in
   * one, so joining them with line breaks handed over a single sentence five
   * claims long. One mentioned an absence, the whole blob was refused, and the
   * repair pass could never fix it because the fault was in how it was handed
   * over rather than in anything the model wrote.
   */
  const { asText } = await import("../tools/competitor-tracker/stages.ts");

  const card = {
    business: "The Barber Shop",
    ranAt: "",
    competitors: [
      {
        name: "SY1 Hair",
        addedByCustomer: false,
        claims: {
          reviews: [
            { text: "SY1 Hair holds 5.0 from 1,151 reviews on Fresha", value: 1151, source: null },
            { text: "No rating appears on any site we read", value: null, source: null },
          ],
        },
      },
    ],
    actions: [],
    sources: [],
    unreadable: [],
  };

  const out = asText(card as never);
  for (const line of out.split("\n")) {
    assert.match(line, /[.!?]$/, `no full stop, so the guards cannot split it: ${line}`);
  }
  // And the two claims really are two sentences to the guard, not one.
  assert.equal(out.split(/(?<=[.!?])\s+/).length >= 3, true);
});

test("the repair is told the exact wordings the guard accepts", () => {
  // Telling it to "say out of what" produced four different unacceptable
  // phrasings across four runs. The guard has a fixed list and it is short.
  const stages = readFileSync(join(ROOT, "tools/competitor-tracker/stages.ts"), "utf8");
  for (const accepted of ["on Booksy", "we looked at", "on any site we read", "4 of 9"]) {
    assert.ok(stages.includes(accepted), `the repair never mentions "${accepted}"`);
  }
});

test("the customer is the first column and never one of the competitors", async () => {
  /**
   * 15 September. Once the customer was correctly removed from the competitor
   * list, the table kept taking competitors[0] as the customer, so SY1 Hair's
   * opening hours appeared under the heading "You" on a battlecard Raj was
   * reading. A competitor wearing your name is worse than no comparison at all.
   */
  const view = readFileSync(join(ROOT, "app/workspace/[tool]/battlecard.tsx"), "utf8");
  assert.ok(
    !/card\.competitors\[0\]/.test(view),
    "the first competitor is being treated as the customer again",
  );
  assert.match(view, /grid\.columns\.map/, "columns come from the grid, which puts the customer first");
});

test("the comparison is a grid, not a list under each name", async () => {
  // A row of bullet points per business cannot be compared: finding who is
  // cheapest meant reading six paragraphs and holding them in your head.
  const stages = readFileSync(join(ROOT, "tools/competitor-tracker/stages.ts"), "utf8");
  assert.match(stages, /One row per thing, one column per business|one column per business/i);
  assert.match(stages, /attribute/, "rows are named, comparable things");
});

/* ── The playbook poisoning itself ───────────────────────────────────────── */

test("a venue page is never mistaken for a listing", async () => {
  /**
   * 15 September. Once a host was trusted, any page on it counted as a listing.
   * A single shop's Booksy venue page was read as "every barber in Shrewsbury",
   * named one business, and then overwrote the playbook's record of where the
   * real listing was. The next run went to the wrong page and found nobody.
   *
   * Being on Booksy is not the same as being Booksy's list of everybody.
   */
  // I wrote my own pattern for this and it flagged the real Booksy listing as a
  // venue, because /s/barber/1227928_shrewsbury also carries digits. Their
  // isVenuePage checks for the search path first, which is the whole
  // difference. Third time today that the agent already had the answer.
  const { isVenuePage } = await import(
    "../../Agents/Competitor Tracker/src/search-visibility.ts"
  );

  assert.equal(isVenuePage("https://booksy.com/en-gb/78530_armando-barbershop_barber_1227928_shrewsbury"), true);
  assert.equal(isVenuePage("https://www.fresha.com/lvp/the-barber-shop-shrewsbury-smithfield-road-VEy9er"), true);
  assert.equal(isVenuePage("https://booksy.com/en-gb/s/barber/1227928_shrewsbury"), false);
  assert.equal(isVenuePage("https://www.fresha.com/lp/en/bt/barbershops/in/gb-shrewsbury"), false);

  const stages = readFileSync(join(ROOT, "tools/competitor-tracker/stages.ts"), "utf8");
  assert.match(stages, /!isVenuePage/, "the listing check is bypassed for trusted hosts again");
});

test("a page naming one business is not filed as a platform", () => {
  // It used to record every page it read with the run's total against each, so
  // a venue naming one shop was filed as a listing naming eighteen.
  const stages = readFileSync(join(ROOT, "tools/competitor-tracker/stages.ts"), "utf8");
  assert.match(stages, /rows\.length >= 3/, "anything is being learned as a platform again");
});

test("where customers find you is not where competitors are listed", async () => {
  /**
   * 15 September. Answering "Facebook or Instagram" sent the searches to
   * facebook.com and instagram.com, which have no page listing every barber in
   * a town. The listing stage found nothing and the run failed with "we could
   * only find 0 other barbers" while the real Booksy listing sat untouched.
   */
  const { platformsFrom } = await import("../tools/questions.ts");
  assert.deepEqual(platformsFrom(["social"]), []);
  // The ones that really are listings still count.
  assert.ok(platformsFrom(["booking"]).includes("booksy.com"));
  assert.ok(platformsFrom(["trades"]).includes("checkatrade.com"));
});

test("the customer's own prices reach the comparison", () => {
  /**
   * 15 September. Their price menu was read at sign-up and all five services
   * stored, and then never handed to the tool. The comparison showed five
   * competitors' prices and "Not published" down the customer's own column, on
   * a business whose prices we had in full. The one column we always have was
   * the one that was empty.
   */
  const stages = readFileSync(join(ROOT, "tools/competitor-tracker/stages.ts"), "utf8");
  assert.match(stages, /business\.services/, "the tool never looks at their own services");
  assert.match(stages, /What \$\{profile\.name\} publishes/, "and never tells the model about them");

  const engine = readFileSync(join(ROOT, "lib/engine.ts"), "utf8");
  assert.match(engine, /services: workspace\.services/, "the engine does not carry them through");
  assert.match(engine, /headline_price, services/, "the engine does not even select them");
});

test("a playbook makes discovery faster, never narrower", () => {
  /**
   * 15 September. The playbook held one host, so the run made exactly one
   * search. It came back without a listing page and the run died with "we could
   * only find 0 other barbers in Shrewsbury" while the real listing sat there
   * untouched. A good playbook should make us faster, not put a whole run on
   * one throw.
   */
  const stages = readFileSync(join(ROOT, "tools/competitor-tracker/stages.ts"), "utf8");
  assert.match(
    stages,
    /\[\.\.\.targeted, \.\.\.buildSearchTerms\(profile\)\]/,
    "the broad searches are not being run alongside the targeted ones",
  );
});

test("every model call is streamed", () => {
  /**
   * 15 September. The SDK refuses a non-streaming request whose token budget
   * could take it past ten minutes: "Streaming is required for operations that
   * may take longer than 10 minutes". Raising the grid's budget to 32,000 to
   * stop it being truncated walked straight into that, and a run died after
   * reading eight pages.
   *
   * Streaming costs nothing and removes the whole class.
   */
  const engine = readFileSync(join(ROOT, "lib/engine.ts"), "utf8");
  assert.ok(
    !/anthropic\.messages\.create\(/.test(engine),
    "a model call is back to non-streaming and will fail on a long answer",
  );
  assert.equal(
    (engine.match(/\.finalMessage\(\)/g) ?? []).length,
    (engine.match(/anthropic\.messages\.stream\(/g) ?? []).length,
    "every stream must be awaited with finalMessage",
  );
});
