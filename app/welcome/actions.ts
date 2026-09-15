"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { detectBusiness } from "@/lib/research/detect";
import { assertNoContactDetails, redact } from "@/lib/privacy/redact";

export type WelcomeState =
  | { stage: "start"; error?: string }
  | {
      stage: "found";
      workspaceId: string;
      website: string;
      name: string;
      trade: string;
      town: string;
      oneLiner: string;
      services: { name: string; price: string | null }[];
      pagesRead: number;
      missing: string[];
    };

export async function detect(
  _previous: WelcomeState,
  form: FormData,
): Promise<WelcomeState> {
  const website = String(form.get("website") ?? "").trim();
  if (!website) return { stage: "start", error: "Put your web address in first." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // The workspace exists from this moment, unconfirmed. confirmed_at stays null
  // until they have looked at what we found and agreed, so everything on this
  // row is openly a guess until they say otherwise.
  const { data: workspace, error: madeError } = await supabase
    .from("workspaces")
    .insert({ owner_id: user.id, website })
    .select("id")
    .single();

  if (madeError || !workspace) {
    return { stage: "start", error: "We could not start that. Try again." };
  }

  const { data: run } = await supabase
    .from("runs")
    .insert({ workspace_id: workspace.id, tool: "detect" })
    .select("id")
    .single();

  const found = await detectBusiness(website);

  // Rule 7: every page we read is stored with its URL and the date, whether it
  // worked or not. A page that refused us is a fact about the research too.
  if (found.sources.length) {
    await supabase.from("sources").insert(
      found.sources.map((s) => ({
        workspace_id: workspace.id,
        url: s.url,
        domain: s.domain,
        fetched_at: s.fetchedAt,
        robots_ok: s.robotsOk,
        status: s.status,
        // A page title is usually a business name and sometimes a person's.
        // Redacted on the way in rather than on the way out, so a contact
        // detail is never in the database to leak in the first place.
        summary: s.ok ? redact(s.title ?? "").text || null : s.note,
      })),
    );
  }

  if (run) {
    await supabase
      .from("runs")
      .update({
        finished_at: new Date().toISOString(),
        ok: !found.problem,
        pages_fetched: found.sources.filter((s) => s.ok).length,
        input_tokens: found.usage.input,
        output_tokens: found.usage.output,
        error: found.problem,
      })
      .eq("id", run.id);
  }

  if (found.problem) {
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    return { stage: "start", error: found.problem };
  }

  // Last gate before anything the model wrote reaches the database. Throws
  // rather than cleaning: at this point something upstream is wrong, and
  // quietly fixing it would hide the bug that caused it.
  assertNoContactDetails(
    { name: found.name, town: found.town, oneLiner: found.oneLiner },
    "what we detected from a website",
  );

  /**
   * The address and the prices are kept, not just shown.
   *
   * They were read at sign-up, displayed on the confirm screen, and thrown
   * away. Choosing which five competitors matter then ranked on proximity with
   * only the town to go on, so every barber in Shrewsbury matched Shrewsbury
   * and the heaviest factor separated nobody, and on price overlap with no
   * price at all.
   */
  const prices = found.services
    .map((s) => Number(String(s.price ?? "").replace(/[^0-9.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  await supabase
    .from("workspaces")
    .update({
      name: found.name,
      trade: found.trade,
      town: found.town,
      address: found.address,
      one_liner: found.oneLiner,
      services: found.services,
      // The cheapest published price. It is what someone comparing on price
      // sees first, and it is the number a competitor has to beat.
      headline_price: prices.length ? Math.min(...prices) : null,
    })
    .eq("id", workspace.id);

  // Named plainly so the screen can say what it could not find, instead of
  // showing an empty box and letting the customer wonder if it broke.
  const missing = [
    !found.name && "the name",
    !found.trade && "what you do",
    !found.town && "where you are",
    !found.services.length && "your prices",
  ].filter(Boolean) as string[];

  return {
    stage: "found",
    workspaceId: workspace.id,
    website,
    name: found.name ?? "",
    trade: found.trade ?? "",
    town: found.town ?? "",
    oneLiner: found.oneLiner ?? "",
    services: found.services,
    pagesRead: found.sources.filter((s) => s.ok).length,
    missing,
  };
}

export async function confirm(form: FormData): Promise<void> {
  const id = String(form.get("workspaceId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // No owner check here on purpose. Row Level Security already refuses to
  // update a row this person does not own, and writing the check twice invites
  // the two copies to disagree later.
  await supabase
    .from("workspaces")
    .update({
      name: String(form.get("name") ?? "").trim() || null,
      // Already an id from the list, because it came from a dropdown.
      trade: String(form.get("trade") ?? "").trim() || null,
      town: String(form.get("town") ?? "").trim() || null,
      one_liner: String(form.get("oneLiner") ?? "").trim() || null,
      // The three things only the owner knows. Everything else on this screen
      // was read off their own website.
      reach: String(form.get("reach") ?? "town"),
      found_via: form.getAll("foundVia").map(String),
      known_competitor: String(form.get("knownCompetitor") ?? "").trim() || null,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id);

  redirect("/workspace");
}

export async function startAgain(form: FormData): Promise<void> {
  const id = String(form.get("workspaceId") ?? "");
  const supabase = await createClient();
  await supabase.from("workspaces").delete().eq("id", id);
  redirect("/welcome");
}
