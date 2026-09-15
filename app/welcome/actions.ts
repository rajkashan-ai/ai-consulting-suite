"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { detectBusiness } from "@/lib/research/detect";

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
        summary: s.ok ? s.title : s.note,
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

  await supabase
    .from("workspaces")
    .update({
      name: found.name,
      trade: found.trade,
      town: found.town,
      one_liner: found.oneLiner,
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
      trade: String(form.get("trade") ?? "").trim().toLowerCase() || null,
      town: String(form.get("town") ?? "").trim() || null,
      one_liner: String(form.get("oneLiner") ?? "").trim() || null,
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
