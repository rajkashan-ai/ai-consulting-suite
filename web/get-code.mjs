#!/usr/bin/env node
/**
 * Get a sign-in code without waiting for an email.
 *
 *     npm run code               rajkashan@gmail.com
 *     npm run code -- someone@example.com
 *
 * WHY THIS EXISTS
 * Supabase's built-in email service is rate limited to a handful an hour and is
 * explicitly not for real use. On 15 September it accepted three requests,
 * answered 200 to all of them, and delivered none. There is nothing to fix in
 * the app: the app asked correctly and was told it had worked.
 *
 * So this asks Supabase for the same code the email would have carried. Same
 * code, same expiry, same sign-in. Only the delivery changes.
 *
 * WHAT MAKES IT SAFE
 *   - It needs the secret key, which lives in .env.local on this machine and in
 *     the server's settings. Nobody without it can run this.
 *   - It refuses anyone not on the allowlist, so it cannot mint a code for an
 *     address that was never invited.
 *   - It prints to your terminal and nowhere else.
 *
 * WHAT IT IS NOT
 * A way into production. Real customers get email, and the fix for them is a
 * real mail service (Resend, Postmark, SES) wired into Supabase, which is on
 * the list and is not this.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV = join(import.meta.dirname, ".env.local");
if (!existsSync(ENV)) {
  console.error("\nNo .env.local. Run npm run setup first.\n");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(ENV, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("\nSupabase is not set up in .env.local. Run npm run setup.\n");
  process.exit(1);
}

const email = (process.argv[2] ?? "rajkashan@gmail.com").trim().toLowerCase();

const db = createClient(url, secret, { auth: { persistSession: false } });

const { data: allowed } = await db
  .from("allowed_emails")
  .select("email, staff")
  .ilike("email", email)
  .maybeSingle();

if (!allowed) {
  console.error(
    `\n${email} is not on the allowlist, so there is no code to give it.\n` +
      `Add it in Supabase, table allowed_emails, then run this again.\n`,
  );
  process.exit(1);
}

const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });

if (error) {
  console.error(`\nSupabase refused: ${error.message}\n`);
  process.exit(1);
}

const code = data?.properties?.email_otp;
if (!code) {
  console.error("\nNo code came back. Sign in through the email instead.\n");
  process.exit(1);
}

console.log(`
  ${email}${allowed.staff ? "   (staff)" : ""}

      ${code}

  Type that into the sign in screen. It lasts one hour.
  Open http://localhost:3000, press Try it for free, put in the email above,
  press Email me a code, then type this instead of waiting for the email.
`);
