import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/routing";

/**
 * Sign in without the email, while this is Raj's machine and nobody else's.
 *
 * WHAT IT SKIPS AND WHAT IT DOES NOT
 * It skips delivery, and only delivery. It still asks Supabase for a real
 * one-time code and still redeems it, so what comes out is an ordinary session
 * made by the ordinary auth system. Nothing downstream can tell the difference,
 * which is the point: a fake session would mean the thing being tested is not
 * the thing that ships.
 *
 * It still checks the allowlist, because Raj asked for that and because it is
 * the rule the product actually has.
 *
 * WHY IT CANNOT REACH A DEPLOYED SITE
 * Three separate refusals, because one is a single edit away from being gone:
 *   - NODE_ENV production
 *   - VERCEL set, which is true of every deploy there even in preview
 *   - ALLOW_DEV_SIGNIN must be explicitly "yes" in .env.local
 * A test asserts all three are here. Without them this is a route that hands
 * out a session to anyone who can guess an email address.
 */
function refused(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    process.env.ALLOW_DEV_SIGNIN !== "yes"
  );
}

export async function POST(request: NextRequest) {
  if (refused()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(form.get("next") ?? ""), "/workspace");

  if (!email) {
    return NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
  }

  const admin = createAdminClient();

  // The allowlist is the rule, and it is the rule here too. Bypassing delivery
  // is not the same as bypassing who is allowed in.
  const { data: allowed } = await admin
    .from("allowed_emails")
    .select("email")
    .ilike("email", email)
    .maybeSingle();

  if (!allowed) {
    return NextResponse.redirect(new URL("/not-invited", request.url), { status: 303 });
  }

  // A real code from the real auth system, never sent anywhere.
  const { data: link, error: madeError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const code = link?.properties?.email_otp;
  if (madeError || !code) {
    return NextResponse.json(
      { error: madeError?.message ?? "Supabase gave no code." },
      { status: 500 },
    );
  }

  // Redeemed through the ordinary client, so the session cookies are written
  // exactly as they are on a normal sign-in.
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
