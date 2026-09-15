import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TOOLS } from "@/tools/registry";
import Nav from "./nav";
import Chrome from "./chrome";

export const metadata = { title: "Workspace" };

export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("is_staff").eq("id", user.id).single(),
    supabase
      .from("workspaces")
      .select("id, name, website, trade, town, one_liner")
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

  const waiting = TOOLS.filter((t) => !t.built).length;

  return (
    <div className="app">
      <Chrome staff={staff} workspaces={workspaces} current={current} />
      <Nav workspaceId={current.id} />

      <main>
        <div className="band band--a band--first">
          <div className="band__in">
            <h1 className="t-page">{current.name ?? current.website}</h1>
            <p className="t-meta">{today}</p>

            <div>
              <h2 className="t-section">What we know about you</h2>
              <div className="panel">
                <dl className="kv">
                  <dt className="t-kind">Website</dt>
                  <dd className="t-row">{current.website}</dd>
                  <dt className="t-kind">What you do</dt>
                  <dd className="t-row">{current.trade ?? "Not found"}</dd>
                  <dt className="t-kind">Where</dt>
                  <dd className="t-row">{current.town ?? "Not found"}</dd>
                  {current.one_liner && (
                    <>
                      <dt className="t-kind">In one line</dt>
                      <dd className="t-row">{current.one_liner}</dd>
                    </>
                  )}
                </dl>
                <p className="t-meta">
                  Read off your own site. Every tool works from this, so wrong
                  here means wrong everywhere.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="band band--b band--last">
          <div className="band__in">
            <h2 className="t-section">Your tools</h2>
            {waiting === TOOLS.length ? (
              <p className="t-doc">
                None of them are written yet. Each one opens, says so, and shows
                what it will be given when somebody builds it.
              </p>
            ) : (
              <p className="t-doc">
                {TOOLS.length - waiting} of {TOOLS.length} are working.
              </p>
            )}

            <ul className="tools">
              {TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    className="tools__row"
                    href={`/workspace/${tool.slug}?w=${current.id}`}
                  >
                    <span className="t-card">{tool.name}</span>
                    <span className="t-meta">{tool.does}</span>
                    <span
                      className={`t-kind ${tool.built ? "kind--good" : "kind--warn"}`}
                    >
                      {tool.built ? "Ready" : "Not built"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
