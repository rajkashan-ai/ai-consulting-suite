import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const W = "5f42eff6-7536-4f13-83d7-a0a841750f1b";

const { data: docs } = await db.from("documents").select("*").eq("workspace_id", W).eq("tool","competitor-tracker");
const { data: runs } = await db.from("runs").select("*").eq("workspace_id", W).eq("tool","competitor-tracker");
const out = `../backups/competitor-tracker-${W.slice(0,8)}-2026-09-18.json`;
writeFileSync(out, JSON.stringify({ takenAt: new Date().toISOString(), workspace: W, documents: docs, runs }, null, 2));
console.log(`backed up ${docs.length} documents and ${runs.length} runs -> ${out}`);
console.log(`bytes: ${readFileSync(out).length.toLocaleString()}`);
for (const d of docs) console.log(`   doc ${d.created_at.slice(0,19)}  ${d.id}`);
