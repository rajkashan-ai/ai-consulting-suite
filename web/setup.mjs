#!/usr/bin/env node
/**
 * One command that sets up Supabase, from a logged-in CLI to a working sign-in.
 *
 * WHAT IT DOES
 *   1. Finds or creates a Supabase project
 *   2. Fetches its keys
 *   3. Runs supabase/*.sql against it, in order
 *   4. Switches the sign-in email from a link to a six digit code
 *   5. Writes .env.local
 *
 * WHAT IT WILL NOT DO
 * Create your Supabase account, or log you in. Both need your password, and a
 * password is not something to hand to a script somebody else wrote.
 *
 * IT NEVER PRINTS A KEY. Everything it fetches goes straight into .env.local,
 * which is gitignored. If you paste this output into a chat or a ticket, you
 * are not pasting a secret. That is deliberate.
 *
 * USE
 *   npx supabase login        (once, opens your browser)
 *   node setup.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import pg from "pg";

const HERE = import.meta.dirname;
const SQL_DIR = join(HERE, "supabase");
const ENV = join(HERE, ".env.local");
const REGION = "eu-west-2"; // London. UK customers, UK data.

/**
 * Nothing here should ever end in a stack trace. A stack names this file, which
 * is never where the problem is, and it buries the one line that says what to
 * do. Raj got forty lines of "at genericNodeError" hiding "Instance size cannot
 * be specified for free plan organizations".
 */
process.on("uncaughtException", (e) => {
  console.error(`\nStopped: ${e.message}\n`);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(`\nStopped: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});

const say = (m) => console.log(m);
const step = (n, m) => console.log(`\n${n}. ${m}`);
const die = (m) => {
  console.error(`\nStopped: ${m}`);
  process.exit(1);
};

/**
 * Run the Supabase CLI and give back its stdout.
 *
 * A failure is shown as the sentence the CLI wrote, not as a Node stack trace.
 * The stack names this file and this line, which is never where the problem is:
 * the problem is in the sentence, and a wall of "at genericNodeError" buries it.
 *
 * It also strips the password out of anything printed. The command line carries
 * it, and a failure that echoes the command puts it on screen and then into
 * whatever the output gets pasted into.
 */
function cli(args, { json = false } = {}) {
  try {
    const out = execFileSync("npx", ["supabase", ...args], {
      cwd: HERE,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
    return json ? JSON.parse(out) : out;
  } catch (e) {
    const said = `${e.stderr ?? ""}${e.stdout ?? ""}`.trim();
    const message = said.match(/\{"message":"([^"]+)"\}/)?.[1] ?? said.split("\n")[0];
    const error = new Error(message || `supabase ${args[0]} ${args[1] ?? ""} failed`);
    error.fromCli = true;
    throw error;
  }
}

const ask = async (q) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(q)).trim();
  rl.close();
  return answer;
};

// ---------------------------------------------------------------------------

/**
 * Anything already in .env.local that this script does not set is kept.
 *
 * It used to offer to overwrite the file, which would have thrown away an
 * Anthropic key that took three attempts to get in. There was never a reason
 * to: this script sets the Supabase settings and nothing else, so it has no
 * business touching a line it did not write.
 */
const already = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const kept = new Map();
for (const line of already.split("\n")) {
  const [name, ...rest] = line.split("=");
  const value = rest.join("=").trim();
  if (name && !name.startsWith("#") && value) kept.set(name.trim(), value);
}
if (kept.size) {
  say(`Keeping ${kept.size} setting${kept.size === 1 ? "" : "s"} already in .env.local: ${[...kept.keys()].join(", ")}`);
}

step(1, "Checking you are logged in");
let projects;
try {
  projects = cli(["projects", "list", "--output", "json"], { json: true });
} catch {
  die("Not logged in. Run this first, it opens your browser:\n\n    npx supabase login\n");
}
say("   Logged in.");

step(2, "Choosing a project");
let ref, dbPassword;

const existing = Array.isArray(projects) ? projects : [];
if (existing.length) {
  say("   You already have:");
  existing.forEach((p, i) => say(`     ${i + 1}. ${p.name}   ${p.region}   ${p.status ?? ""}`));
  say("");
  say("   Picking one of these runs our tables INTO it, alongside whatever is");
  say("   already there. Only pick one you made for this. Press enter for a new");
  say("   project, which is almost certainly what you want.");
  const pick = await ask(`   Number, or enter for a new one: `);
  if (pick) {
    const chosen = existing[Number(pick) - 1];
    if (!chosen) die("That was not one of the numbers above.");
    ref = chosen.id;
    say(`   Using ${chosen.name}.`);
    dbPassword = await ask("   Its database password (from when you made it): ");
  }
}

if (!ref) {
  const orgs = cli(["orgs", "list", "--output", "json"], { json: true });
  if (!orgs.length) die("No organisation on your Supabase account. Make one in the dashboard.");
  const org = orgs[0];
  if (orgs.length > 1) say(`   More than one organisation. Using the first: ${org.name}.`);

  const name = (await ask("   Name for the new project [ai-suite]: ")) || "ai-suite";
  dbPassword = await ask("   Pick a database password (write it down, you cannot see it again): ");
  if (dbPassword.length < 12) die("Use at least 12 characters.");

  say(`   Creating ${name} in London. This takes a minute or two.`);
  // No --size. A free plan refuses it outright: "Instance size cannot be
  // specified for free plan organizations". Leaving it out gets the only size a
  // free plan has, which is the one we wanted anyway.
  const made = cli(
    ["projects", "create", name, "--org-id", org.id, "--db-password", dbPassword,
     "--region", REGION, "--output", "json"],
    { json: true },
  );
  ref = made.id ?? made.ref;
  if (!ref) die("The project was created but I could not read its reference.");
  say(`   Made it.`);
}

step(3, "Waiting for the database to accept connections");

/**
 * Ask Supabase where the database is rather than guessing the hostname. The
 * pooler host has had more than one shape (aws-0-, aws-1-) and a guess that is
 * one character out fails as "could not connect", which sends you looking at
 * your network instead of at this line.
 *
 * If there is no access token to ask with, fall back to the two shapes that
 * exist and try each. Trying is cheap; being wrong is a confusing evening.
 */
const token = process.env.SUPABASE_ACCESS_TOKEN ?? readAccessToken();

let ways = [];
if (token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const info = await res.json();
    if (info?.database?.host) {
      ways.push({ host: info.database.host, port: 5432, user: "postgres" });
    }
  }
}
ways.push(
  { host: `aws-0-${REGION}.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` },
  { host: `aws-1-${REGION}.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
);

let client = null;
let lastError = "";
outer: for (let round = 1; round <= 10; round++) {
  for (const way of ways) {
    try {
      const c = new pg.Client({
        ...way,
        database: "postgres",
        password: dbPassword,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15_000,
      });
      await c.connect();
      client = c;
      say(`   Connected on ${way.host}.`);
      break outer;
    } catch (e) {
      lastError = e.message;
      // A wrong password is not going to become right by waiting.
      if (/password authentication failed/i.test(e.message)) {
        die("That database password is wrong. Run this again with the right one.");
      }
    }
  }
  if (round === 1) say("   Still starting up. This takes a couple of minutes on a new project.");
  await new Promise((r) => setTimeout(r, 20_000));
}
if (!client) die(`Could not reach the database.\nLast error: ${lastError}`);

step(4, "Running the SQL");
const files = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  try {
    await client.query(readFileSync(join(SQL_DIR, file), "utf8"));
    say(`   ok  ${file}`);
  } catch (e) {
    await client.end();
    die(`${file} failed:\n\n   ${e.message}\n\n   Nothing after this point ran.`);
  }
}

const { rows } = await client.query(
  "select email, staff from public.allowed_emails order by email",
);
say(`   ${rows.length} people may sign in:`);
rows.forEach((r) => say(`     ${r.email}${r.staff ? "   (staff)" : ""}`));
await client.end();

step(5, "Fetching the keys");
// --reveal, or the secret key comes back masked and .env.local gets a string of
// dots that fails at the first request with an unhelpful error.
const keys = cli(
  ["projects", "api-keys", "--project-ref", ref, "--reveal", "--output", "json"],
  { json: true },
);
const find = (...names) =>
  keys.find((k) => names.includes(k.name))?.api_key ??
  keys.find((k) => names.includes(k.type))?.api_key;

const anon = find("anon", "publishable");
const secret = find("service_role", "secret");
if (!anon || !secret) die("Could not read the project keys. Copy them from the dashboard.");
say("   Got them. Not printing them.");

step(6, "Switching the sign-in email to a six digit code");
// A link in an email gets followed by company mail scanners before a person
// reads it, which spends the one-time login and produces a failure nobody can
// explain. A code has to be typed, so a robot cannot spend it.
let templateDone = false;
/** Anything the script could not do, said at the end where it will be read. */
const leftForYou = [];
if (token) {
  const body = {
    mailer_otp_exp: 3600,
    mailer_templates_magic_link_content:
      `<h2>Your sign in code</h2>` +
      `<p>Enter this on the sign in screen. It lasts one hour.</p>` +
      `<p style="font-size:28px;letter-spacing:.2em;font-weight:700">{{ .Token }}</p>` +
      `<p>If you did not ask for this, ignore it. Nobody can get in without the code.</p>`,
  };
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  templateDone = res.ok;
  if (!res.ok) say(`   Could not set it automatically (${res.status}).`);
}
if (templateDone) {
  say("   Done. The email now carries a code.");
} else {
  // Printed as the last thing, not the sixth of seven. The CLI keeps its access
  // token in the keychain, so this usually cannot be done automatically, and a
  // note in the middle of a successful run is a note nobody reads. Raj signed
  // in, got a link, and had to come back and ask.
  leftForYou.push(
    "THE SIGN IN EMAIL WILL CARRY A LINK, NOT A CODE.\n" +
    "   Supabase dashboard, Authentication, Email Templates, Magic Link.\n" +
    "   Replace the whole body with:  {{ .Token }}\n" +
    "   Takes thirty seconds. Until then the six digit box has nothing to put\n" +
    "   in it, and `npm run code` gets you a code without the email.",
  );
}

step(7, "Writing .env.local");
const settings = new Map(kept);
settings.set("NEXT_PUBLIC_SUPABASE_URL", `https://${ref}.supabase.co`);
settings.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
settings.set("SUPABASE_SERVICE_ROLE_KEY", secret);
if (!settings.get("ANTHROPIC_API_KEY")) settings.set("ANTHROPIC_API_KEY", "");
// Only used by the scheduled tick, and it refuses everything without one.
if (!settings.get("CRON_SECRET")) {
  settings.set("CRON_SECRET", randomBytes(24).toString("base64url"));
}

writeFileSync(
  ENV,
  [
    "# Supabase lines written by setup.mjs. Never commit this file.",
    ...[...settings].map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n"),
  { mode: 0o600 },
);
say(`   Written. ${settings.size} settings, ${kept.size} of them kept from before.`);

if (leftForYou.length) {
  say("\n" + "=".repeat(68));
  say("  STILL FOR YOU TO DO");
  say("=".repeat(68));
  for (const item of leftForYou) say(`\n   ${item}`);
  say("\n" + "=".repeat(68));
}

say(`
Done.

    npm run dev

Then open http://localhost:3000, press "Try it for free", and sign in with
${rows[0]?.email ?? "your email"}.

Google sign-in is not set up yet and its button will not work. The six digit
code will. Section 2 of SETUP.md covers Google when you want it.
`);

// ---------------------------------------------------------------------------

/** The CLI keeps its token in the OS keychain, but honours this file too. */
function readAccessToken() {
  for (const p of [
    join(process.env.HOME ?? "", ".supabase", "access-token"),
    join(process.env.HOME ?? "", ".config", "supabase", "access-token"),
  ]) {
    try {
      return readFileSync(p, "utf8").trim();
    } catch {
      /* not there */
    }
  }
  return null;
}
