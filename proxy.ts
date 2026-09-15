import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

const PUBLIC_PATHS = ["/", "/sign-in", "/not-invited", "/auth", "/preview"];

export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Nothing configured yet. Say so in one sentence rather than throwing a stack
  // trace on every route, and serve nothing at all rather than serving pages
  // with the auth check quietly skipped.
  // The preview page is example content with nothing behind it, so it is the
  // one thing worth looking at before any of the accounts exist.
  if ((!url || !key) && request.nextUrl.pathname.startsWith("/preview")) {
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

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    // Where they were going, so they land there after signing in rather than
    // on a home screen having forgotten why they came.
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/sign-in" || path === "/")) {
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
