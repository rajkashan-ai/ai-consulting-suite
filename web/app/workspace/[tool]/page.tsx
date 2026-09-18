import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelFor } from "@/tools/categories";
import { toolBySlug } from "@/tools/registry";
import Shell from "../shell";
import { LAYS_OUT_ITS_OWN_BANDS, screenFor } from "./screens";
import { readyFor } from "./ready";
import { refused } from "@/lib/problems";
import { createAdminClient } from "@/lib/supabase/admin";

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

  /**
   * They asked for a business that is not theirs, and we quietly gave them
   * their own instead.
   *
   * Row level security already stops the data crossing: `workspaces` above is
   * scoped to the owner, so an id that is not theirs simply is not in the list.
   * What was missing is any record that the request happened. RLS refuses by
   * returning nothing, so a refusal and an empty result looked identical, and
   * the most important security event in this product was invisible.
   *
   * The id they asked for is deliberately not recorded: it is somebody else's,
   * and it does not belong in our table.
   */
  if (wanted && wanted !== current.id) {
    await refused(createAdminClient() as never, {
      asked: "a business",
      where: "/workspace/[tool]",
      action: "open a business",
      workspaceId: current.id,
    });
  }

  /**
   * The tool's own screen, found by the slug already in the url.
   *
   * This page named one tool and rendered it for every tool marked built. It
   * is the same coupling the engine had, fixed the same way: look it up and
   * render whatever comes back. A tool marked built with no screen falls
   * through to the not-built panel, which is honest rather than broken.
   */
  const View = tool.built ? screenFor(tool.slug) : null;
  const ownsBands = Boolean(View) && LAYS_OUT_ITS_OWN_BANDS.includes(tool.slug);

  /* London, always. A date rendered in the server's timezone tells a salon in
     St Albans what day it is somewhere else. */
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date());

  return (
    <Shell
      staff={profile?.is_staff ?? false}
      workspaces={workspaces}
      current={current}
      today={today}
      savedLabel={null}
      savedSub="Nothing measured yet. It starts once an agent has run."
    >
      <>
        {/* The tool's own header continues the frame rather than starting a
            white page under it. The name and the one line saying what the tool
            is belong to the frame; everything below is the answer. */}
        <div className="toolhead">
          <div className="band__in">
            {/* The business is the subject of the page, so the business is the
                heading. The tool's name labels which tool you are in, and the
                line saying what it does sits under both.

                It was the other way round for an afternoon: the tool's tagline
                as the page title, which put a sentence in a slot sized for two
                or three words and told the reader something they already knew
                from clicking the tab. */}
            <p className="toolhead__kind">{tool.name}</p>
            <h1 className="t-page toolhead__h">{current.name ?? current.website}</h1>
            <p className="toolhead__does">{tool.does}</p>
          </div>
        </div>

        {/* The band wrapper belongs to the tool, not to this page.
            One band around everything made a seven section screen read as one
            undifferentiated column: no ground change, no landmark, nothing for
            a reader to recognise where they are by. A tool that lays out its
            own bands says so with `ownsBands`; one that does not gets this
            wrapper, which is what the Tracker's tabbed page wants. */}
        {ownsBands ? (
          View ? <View workspaceId={current.id} ready={readyFor(tool.slug, current)} /> : null
        ) : (
        <div className="band band--a band--first band--last">
          <div className="band__in">

            {View ? (
              <View workspaceId={current.id} ready={readyFor(tool.slug, current)} />
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
                      <dd className="t-row">{labelFor(current.trade)}</dd>
                      <dt className="t-kind">Where</dt>
                      <dd className="t-row">{current.town ?? "Not found"}</dd>
                    </dl>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
        )}
      </>
    </Shell>
  );
}
