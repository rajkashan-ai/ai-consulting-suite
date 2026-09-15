import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "./nav";

export const metadata = { title: "Workspace" };

const TOOLS = [
  "Competitor Tracker",
  "Content & Social Planner",
  "Proposal & Quote Builder",
  "Lead Capture & Funnel Builder",
  "Pricing & Package Builder",
  "Process & SOP Builder",
];

export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("is_staff, email").eq("id", user.id).single(),
    supabase
      .from("workspaces")
      .select("id, name, website, trade, town, confirmed_at")
      .not("confirmed_at", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (!workspaces?.length) redirect("/welcome");

  const staff = profile?.is_staff ?? false;
  const wanted = (await searchParams).w;
  const current = workspaces.find((w) => w.id === wanted) ?? workspaces[0];

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="app">
      <header>
        <span className="logo">
          <span className="logo__mark" />
          Suite
        </span>
        {/* Staff only. A customer has one business, so anything implying a
            second one is forbidden by UI/CLAUDE.md section 7. */}
        {staff && workspaces.length > 1 && (
          <form className="chooser">
            <select
              name="w"
              className="field"
              defaultValue={current.id}
              aria-label="Which business you are testing"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name ?? w.website}
                </option>
              ))}
            </select>
            <button className="btn--sm btn--ghost" type="submit">
              Open
            </button>
          </form>
        )}
        {staff && (
          <a className="btn--sm btn--ghost" href="/welcome">
            Test another
          </a>
        )}
        <form action="/auth/sign-out" method="post">
          <button className="acct acct--button" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <Nav tools={TOOLS} />

      <main>
        <div className="band band--a band--first">
          <div className="band__in">
            <h1 className="t-page">{current.name ?? current.website}</h1>
            <p className="t-meta">{today}</p>

            <div>
              <h2 className="t-section">What moved</h2>
              <div className="panel">
                <h3 className="t-sub">Nothing to compare yet.</h3>
                <p className="t-doc">
                  Nothing has run for {current.name ?? "this business"} yet. Open
                  the Competitor Tracker and we will write down where everyone
                  stands today, then tell you what moved next Monday.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="band band--b band--last">
          <div className="band__in">
            <h2 className="t-section">What we know about you</h2>
            <div className="panel">
              <dl className="kv">
                <dt className="t-kind">Website</dt>
                <dd className="t-row">{current.website}</dd>
                <dt className="t-kind">What you do</dt>
                <dd className="t-row">{current.trade ?? "Not set"}</dd>
                <dt className="t-kind">Where</dt>
                <dd className="t-row">{current.town ?? "Not set"}</dd>
              </dl>
              <p className="t-meta">
                Every tool reads this. Wrong here means wrong everywhere.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
