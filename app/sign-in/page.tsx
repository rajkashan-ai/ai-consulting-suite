import { Suspense } from "react";
import SignInForm from "./form";
import { createAdminClient } from "@/lib/supabase/admin";

/** Three refusals, not one, because one is a single edit away from being gone. */
const devSignInOn = () =>
  process.env.NODE_ENV !== "production" &&
  !process.env.VERCEL &&
  process.env.ALLOW_DEV_SIGNIN === "yes";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Only ever the allowlist, and only ever on this machine. Listing the real
  // addresses is safe here for the same reason the whole route is: it cannot
  // exist anywhere but a development machine that has switched it on.
  const quick = devSignInOn()
    ? ((await createAdminClient().from("allowed_emails").select("email").order("email")).data ?? [])
    : [];

  return (
    <main className="auth">
      <div className="auth__card">
        <p className="logo logo--dark">
          <span className="logo__mark" />
          Suite
        </p>
        <h1 className="t-display-3">Sign in</h1>
        <p className="t-doc">
          No password. Either sign in with Google, or we send a six digit code
          to your email.
        </p>
        <Suspense>
          <SignInForm />
        </Suspense>

        {quick.length > 0 && (
          <div className="bypass">
            <p className="t-kind">Straight in, no email</p>
            <p className="t-micro">
              On this machine only. Checks the allowlist and nothing else, and
              does not exist on a deployed site.
            </p>
            {quick.map((row) => (
              <form key={row.email} action="/api/dev-signin" method="post">
                <input type="hidden" name="email" value={row.email} />
                <button className="btn--ghost" type="submit">
                  Sign in as {row.email}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
