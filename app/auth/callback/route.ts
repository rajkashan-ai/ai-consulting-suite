import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sends people back to.
 *
 * Supabase hands us a one-time code in the URL. We swap it for a session, which
 * is the moment the database trigger runs and decides whether this person is on
 * the allowlist. If they are not, the trigger aborts the signup and we land
 * here holding an error rather than a session.
 *
 * That is the design: someone we did not invite leaves no row behind at all,
 * not even an unused account. An account we never wanted is still somebody's
 * personal data sitting in our database.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/workspace";

  // Google's own refusal, for example someone pressing cancel on the consent
  // screen. Not an error worth a page: send them back to try again.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const message = `${error.message} ${error.code ?? ""}`.toLowerCase();
    const turnedAway =
      message.includes("not_invited") ||
      message.includes("42501") ||
      // Supabase wraps an exception raised inside the signup trigger as a
      // generic database error, so this is the shape a rejection actually
      // arrives in. Checked here rather than assumed.
      message.includes("database error");

    return NextResponse.redirect(
      `${origin}/${turnedAway ? "not-invited" : "sign-in"}`,
    );
  }

  // Only ever redirect inside our own site. `next` comes off the URL, so
  // without this someone could send a link that signs a person in and then
  // bounces them to a site of the attacker's choosing, carrying our name.
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/workspace";
  return NextResponse.redirect(`${origin}${safe}`);
}
