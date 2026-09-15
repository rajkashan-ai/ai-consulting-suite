import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decide, WORKS_WITHOUT_SUPABASE } from "@/lib/routing";

/**
 * Runs before every page. Two jobs.
 *
 * Called proxy.ts because Next 16 renamed the middleware convention. Same file,
 * same job, new name.
 *
 * One: refresh the session. Supabase tokens are short lived, and a server
 * component cannot write a cookie, so if nothing refreshed them here a person
 * would be signed out mid-session for no visible reason.
 *
 * Two: decide who may see what. This is convenience, not security. Row Level
 * Security is what actually protects the data; this only saves someone from
 * loading a page that would be empty anyway, and it is written that way round
 * on purpose. Never move a real access decision into this file.
 */

export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Nothing configured yet. Say so in one sentence rather than throwing a stack
  // trace on every route, and serve nothing at all rather than serving pages
  // with the auth check quietly skipped.
  // Two pages are meant to work before Supabase exists, so the not-set-up
  // answer must not reach them. /preview is example content with nothing
  // behind it. /try is the website reader, which needs an Anthropic key and no
  // database at all, and refuses itself on a deployed site.
  if (
    (!url || !key) &&
    WORKS_WITHOUT_SUPABASE.some(
      (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`),
    )
  ) {
    return NextResponse.next({ request });
  }

  if (!url || !key) {
    return new NextResponse(
      "Not set up yet. Copy .env.local.example to .env.local and fill it in. See SETUP.md.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser, never getSession. getSession reads the cookie and believes it.
  // getUser asks Supabase to verify the token, which is the difference between
  // trusting a value the browser sent us and knowing who somebody is.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * A sign-in link from an email lands on the site root, not on our callback.
   *
   * Supabase sends people to the project's Site URL after verifying the link,
   * and that is "/", which here is a static landing page that ignores the code
   * sitting in the address bar. So the link appeared to work, bounced you to
   * the landing page, and signed you into nothing.
   *
   * Catching it here rather than changing Site URL in the dashboard, because
   * Site URL is used for several things and bending it to suit one of them is
   * how a setting ends up wrong for the others. This also keeps working if
   * somebody changes it.
   */
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const decision = decide(request.nextUrl.pathname, Boolean(user));

  if (decision.go === "sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", decision.next);
    return NextResponse.redirect(url);
  }

  if (decision.go === "workspace") {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own assets and image files. Matching those would
    // run a database-backed auth check against every icon on the page.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
