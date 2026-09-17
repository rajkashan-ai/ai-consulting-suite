import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteEverything } from "./actions";

export const metadata = { title: "Your account" };

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: workspaces }, { count: documents }] = await Promise.all([
    supabase.from("workspaces").select("id, name, website"),
    supabase.from("documents").select("id", { count: "exact", head: true }),
  ]);

  const problem = (await searchParams).error;

  return (
    <main className="band band--a band--first band--last">
      <div className="band__in">
        <h1 className="t-page">Your account</h1>

        <div>
          <h2 className="t-section">What we hold</h2>
          <div className="panel">
            <dl className="kv">
              <dt className="t-kind">Signed in as</dt>
              <dd className="t-row">{user.email}</dd>
              <dt className="t-kind">How you sign in</dt>
              <dd className="t-row">
                {user.app_metadata?.provider === "google"
                  ? "Google. We never see a password"
                  : "A code to your email. There is no password"}
              </dd>
              <dt className="t-kind">Businesses</dt>
              <dd className="t-row">{workspaces?.length ?? 0}</dd>
              <dt className="t-kind">Documents</dt>
              <dd className="t-row">{documents ?? 0}</dd>
            </dl>
            <p className="t-meta">
              We also keep the address and date of every public page we read for
              you, for 400 days, so any figure can be traced back to where it
              came from.
            </p>
          </div>
        </div>

        <div>
          <h2 className="t-section">Take a copy</h2>
          <div className="panel">
            <p className="t-doc">
              Everything above, as one file you can read or give to somebody
              else. It is yours.
            </p>
            {/* A plain link, not a fetch. The browser saves the file itself. */}
            <a className="btn--ghost" href="/account/export" download>
              Download everything
            </a>
          </div>
        </div>

        <div>
          <h2 className="t-section">Close your account</h2>
          <div className="panel">
            <p className="t-doc">
              This deletes your account, your business, every document and every
              source. It happens immediately and we cannot undo it or get it
              back for you.
            </p>
            <form action={deleteEverything} className="auth__form">
              <label className="t-kind" htmlFor="confirm">
                Type delete to confirm
              </label>
              <input
                id="confirm"
                name="confirm"
                className="field"
                autoComplete="off"
                required
              />
              {problem === "confirm" && (
                <p className="auth__error t-doc-sm">
                  Nothing was deleted. Type the word delete exactly.
                </p>
              )}
              {problem === "failed" && (
                <p className="auth__error t-doc-sm">
                  That did not work and nothing was deleted. Tell Raj.
                </p>
              )}
              <button className="btn--ghost btn--danger" type="submit">
                Delete everything
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
