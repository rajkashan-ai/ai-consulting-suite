import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL } from "../../../../Agents/Content & Social Planner/src/types";
import Shell from "../shell";
import { saveProfile } from "../profile-actions";

/**
 * Your business, and everything they can change about it.
 *
 * WHY THIS EXISTS SEPARATELY FROM SIGN-UP
 * Signing up needs a web address and nothing else. That is deliberate: somebody
 * should be able to see what the tools do before deciding whether we are worth
 * typing an address into. But a business changes, and what they told us on the
 * first afternoon was a guess we made off their website and asked them to
 * correct. Without a way back to it, the correction never happens and every
 * post carries the guess.
 *
 * So it is in the sidebar, reachable on any screen, on any day.
 *
 * WHY THE EMAIL IS SHOWN AND NOT ASKED FOR
 * Everybody who can sign in is on an approved list, so we already hold the
 * address they authenticated with. Asking for it again is asking a question we
 * know the answer to. The field here is for the other case: an owner signed in
 * as themselves who wants things going to the salon's shared inbox.
 */
export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { w } = await searchParams;

  const [{ data: profile }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("is_staff").eq("id", user.id).single(),
    supabase
      .from("workspaces")
      .select("id, name, website, trade, town, address, one_liner, channels, contact_email")
      .order("created_at", { ascending: true }),
  ]);

  const current = (w ? workspaces?.find((x) => x.id === w) : workspaces?.[0]) ?? workspaces?.[0];
  if (!current) redirect("/welcome");

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date());

  const chosen = new Set((current.channels ?? []) as string[]);
  const asked = current.channels !== null && current.channels !== undefined;

  return (
    <Shell
      staff={profile?.is_staff ?? false}
      workspaces={(workspaces ?? []) as never}
      current={current as never}
      today={today}
      savedLabel={null}
      savedSub="Nothing measured yet. It starts once an agent has run."
    >
      <div className="toolhead">
        <div className="band__in">
          <p className="toolhead__kind">Your business</p>
          <h1 className="toolhead__h t-page">{current.name ?? current.website}</h1>
          <p className="t-doc u-measure">
            Everything here is optional. The tools work without it and they work
            better with it, and you can change any of it whenever you like.
          </p>
        </div>
      </div>

      <div className="band band--a band--first band--last">
        <div className="band__in">
          <form action={saveProfile} className="profile">
            <input type="hidden" name="workspaceId" value={current.id} />

            <h2 className="t-section">The basics</h2>

            <label className="t-kind" htmlFor="name">
              Business name
            </label>
            <input
              id="name"
              name="name"
              className="field"
              defaultValue={current.name ?? ""}
              placeholder="A Cut Above"
            />

            <label className="t-kind" htmlFor="website">
              Website
            </label>
            <input
              id="website"
              name="website"
              className="field"
              type="url"
              defaultValue={current.website ?? ""}
              placeholder="https://yoursalon.co.uk"
            />
            <p className="t-micro">
              This is the one thing the tools cannot work without. Everything we
              write comes off these pages.
            </p>

            <label className="t-kind" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              name="address"
              className="field"
              defaultValue={current.address ?? ""}
              placeholder="19 High Street, St Albans AL3 4EH"
            />

            <label className="t-kind" htmlFor="town">
              Town
            </label>
            <input
              id="town"
              name="town"
              className="field"
              defaultValue={current.town ?? ""}
              placeholder="St Albans"
            />
            <p className="t-micro">
              Used to find the businesses you are up against, so a wrong town
              compares you with the wrong people.
            </p>

            <label className="t-kind" htmlFor="one_liner">
              In one line
            </label>
            <input
              id="one_liner"
              name="one_liner"
              className="field"
              defaultValue={current.one_liner ?? ""}
              placeholder="Independent hair and beauty salon in the centre of St Albans"
            />

            <h2 className="t-section">Where we send things</h2>

            <label className="t-kind" htmlFor="contact_email">
              Email
            </label>
            <input
              id="contact_email"
              name="contact_email"
              className="field"
              type="email"
              defaultValue={current.contact_email ?? ""}
              placeholder={user.email ?? ""}
            />
            <p className="t-micro">
              {current.contact_email
                ? `Leave it empty and things go to ${user.email}, the address you sign in with.`
                : `Empty, so things go to ${user.email}, the address you sign in with. Put another one here to send them somewhere else, like a shared inbox.`}
            </p>

            <h2 className="t-section">Where you post</h2>
            {/* The marker that tells "we asked and they post nowhere" apart from
                "nobody asked". Without it an unticked form and an unanswered
                one look the same, and only one of them should fall back to
                reading their page text. */}
            <input type="hidden" name="channelsAsked" value="1" />
            <div className="controls">
              {(Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]).map((c) => (
                <label className="check" key={c}>
                  <input type="checkbox" name="channel" value={c} defaultChecked={chosen.has(c)} />
                  {CHANNEL[c].label}
                </label>
              ))}
            </div>
            <p className="t-micro">
              {asked
                ? "We plan around these. Untick them all if you post nowhere yet, and we will stop guessing."
                : "We have been reading your site to guess this. Tell us and we will stop guessing."}
            </p>

            <div className="make__row">
              <button className="btn" type="submit">
                Save
              </button>
              <span className="t-meta">Nothing here is required.</span>
            </div>
          </form>
        </div>
      </div>
    </Shell>
  );
}
