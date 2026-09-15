import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toolBySlug } from "@/tools/registry";
import Nav from "../nav";
import Chrome from "../chrome";
import CompetitorTracker from "./competitor-tracker";

export default async function ToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ tool: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const tool = toolBySlug((await params).tool);
  if (!tool) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("is_staff").eq("id", user.id).single(),
    supabase
      .from("workspaces")
      .select("id, name, website, trade, town")
      .not("confirmed_at", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (!workspaces?.length) redirect("/welcome");
  const wanted = (await searchParams).w;
  const current = workspaces.find((w) => w.id === wanted) ?? workspaces[0];

  return (
    <div className="app">
      <Chrome
        staff={profile?.is_staff ?? false}
        workspaces={workspaces}
        current={current}
      />
      <Nav workspaceId={current.id} />

      <main>
        <div className="band band--a band--first band--last">
          <div className="band__in">
            <h1 className="t-page">{tool.name}</h1>
            <p className="t-doc">{tool.does}</p>

            {tool.built ? (
              <CompetitorTracker
                workspaceId={current.id}
                ready={Boolean(current.trade && current.town)}
              />
            ) : (
              <>
                {/* Not built is said plainly. A screen that shows nothing and
                    explains nothing reads as broken, and the customer cannot
                    tell "not written yet" from "it failed". */}
                <div className="panel">
                  <h2 className="t-sub">This one is not built yet.</h2>
                  <p className="t-doc">
                    Nothing runs here. When it is written it will read{" "}
                    {current.website} and work from{" "}
                    {current.trade
                      ? `what a ${current.trade} needs`
                      : "what this business does"}
                    {current.town ? `, in ${current.town}` : ""}.
                  </p>
                  <p className="t-meta">
                    Everything around it works: signing in, which business is
                    open, reading pages, storing what came back and showing it.
                    What is missing is this tool&rsquo;s own job.
                  </p>
                </div>

                <div>
                  <h2 className="t-section">What it will be given</h2>
                  <div className="panel">
                    <dl className="kv">
                      <dt className="t-kind">Website</dt>
                      <dd className="t-row">{current.website}</dd>
                      <dt className="t-kind">What they do</dt>
                      <dd className="t-row">{current.trade ?? "Not found"}</dd>
                      <dt className="t-kind">Where</dt>
                      <dd className="t-row">{current.town ?? "Not found"}</dd>
                    </dl>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
