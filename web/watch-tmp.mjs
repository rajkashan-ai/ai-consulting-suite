import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const W = "5f42eff6-7536-4f13-83d7-a0a841750f1b";
const from = new Date().toISOString();
console.log("watching for posts made after", from.slice(11,19));
const seen = new Set();
for (let i = 0; i < 200; i++) {
  const { data } = await db.from("content_made").select("*").eq("workspace_id", W).gt("made_at", from).order("made_at");
  for (const p of data ?? []) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    console.log(`\n=== ${p.path} / ${p.intent} === ${String(p.made_at).slice(11,19)}`);
    if (p.thought) console.log(`what you typed: "${p.thought}"`);
    console.log(`\n${p.words}\n`);
    console.log(`shot: ${p.shot}`);
    console.log(`why : ${p.why}`);
    console.log(`from: ${p.source_url}${p.source_on ? ` read ${p.source_on}` : ""}`);
  }
  await new Promise(s => setTimeout(s, 5000));
}
