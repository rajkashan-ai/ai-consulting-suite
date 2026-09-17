import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const W = "5f42eff6-7536-4f13-83d7-a0a841750f1b";
const from = new Date().toISOString();   // only a run started from now
console.log("waiting for a new run, from", from.slice(11,19));
let last = "";
for (let i = 0; i < 300; i++) {
  const { data } = await db.from("runs").select("id, stage, ok, error, progress, state, started_at")
    .eq("workspace_id", W).gt("started_at", from).order("started_at", { ascending: false }).limit(1);
  const r = data?.[0];
  if (r) {
    const cost = r.state?.watch?.cost ?? {};
    const billed = Math.round(Object.values(cost).reduce((n,c)=>n+(c?.input??0)+(c?.cacheWritten??0)*1.25+(c?.cacheRead??0)*0.1,0));
    const line = `${r.stage} | ${r.progress ?? ""} | billed ${billed.toLocaleString()}`;
    if (line !== last) {
      console.log(`${new Date().toISOString().slice(11,19)}  ${line}`);
      const secs = Object.entries(cost).map(([k,c])=>`${k} ${c.seconds.toFixed(0)}s`).join("  ");
      if (secs) console.log(`          ${secs}`);
      last = line;
    }
    if (r.stage === "done" || r.stage === "failed") {
      console.log(`\n=== ${r.stage.toUpperCase()} ===`);
      console.log("shown  :", r.error ?? "(none)");
      console.log("reason :", r.state?.watch?.stopped ?? "(none)");
      console.log("chosen :", JSON.stringify(r.state?.chosen ?? null));
      console.log("typed  :", JSON.stringify(r.state?.typed ?? null));
      console.log("lookedUp:", JSON.stringify(r.state?.lookedUp ?? null));
      console.log("queue  :", JSON.stringify((r.state?.queue ?? []).map(q=>q.name)));
      console.log("run    :", r.id);
      break;
    }
  }
  await new Promise(s => setTimeout(s, 6000));
}
