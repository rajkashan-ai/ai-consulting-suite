import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { askFor, namesFrom } from "../tools/competitor-tracker/naming.ts";

/**
 * The naming stage, against the real API.
 *
 * WHY THIS IS SEPARATE FROM `npm test`
 * It costs money and it reaches the internet. Everything in test/ is free,
 * offline and deterministic, and the moment one file in there is neither, the
 * suite stops being something anybody runs on every commit. So this lives
 * apart, runs only when asked, and `npm test` never touches it.
 *
 *     npm run smoke
 *
 * WHY IT EXISTS AT ALL
 * The offline suite covers the whole pipeline against recorded pages, and the
 * fake answers for the model. What it cannot answer is whether the model
 * actually searches and whether what it says back can be read, and both were
 * new on 2026-09-17. A full live run costs about a pound; this costs about
 * five pence and covers the only part that was unproven.
 *
 * It was first written as a throwaway script that printed six names, which I
 * read with my eyes and then deleted. That is a demo. This asserts.
 *
 * DELIBERATELY ON HAIKU
 * A plumbing and behaviour check, not a quality one. If a small model searches
 * and answers in a readable shape, the call is wired correctly. Judging whether
 * the names are the right names is what a live run is for.
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const profile = { name: "A Cut Above St Albans", trade: "hairdresser", town: "St Albans" };

/** The same shape lib/engine.ts builds, so this tests our call and not a toy. */
const SEARCH = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 4,
  user_location: { type: "approximate", city: "St Albans", country: "GB" },
};

const SYSTEM =
  "You find the local businesses that compete with a UK small business. " +
  "Search before you answer: these are real shops that open and close, and " +
  "what you remember is out of date. Name only businesses you have seen in " +
  "a search result. Trading names as a customer would say them, one per " +
  "line, no commentary, no directories, no listing sites.";

test("the naming call searches, and its answer can be read", async (t) => {
  if (!env.ANTHROPIC_API_KEY) {
    t.skip("no key in .env.local");
    return;
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const reply = await anthropic.messages
    .stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1_500,
      system: SYSTEM,
      tools: [SEARCH as never],
      messages: [{ role: "user", content: askFor(profile) }],
    })
    .finalMessage();

  const searches =
    (reply.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use
      ?.web_search_requests ?? 0;

  const text = reply.content
    .filter((c) => c.type === "text")
    .map((c) => ("text" in c ? c.text : ""))
    .join("\n");

  const names = namesFrom(text, profile.name);

  // What it cost, printed rather than asserted: it varies, and a test that
  // fails on a token count would be noise. It is here so the price of running
  // this is never a mystery.
  console.log(
    `      ${reply.usage.input_tokens} in, ${reply.usage.output_tokens} out, ` +
      `${searches} searches, ${names.length} names`,
  );

  assert.ok(searches > 0, "it answered from memory, which is the fault this change fixed");

  assert.ok(
    names.length >= 3,
    `only ${names.length} names came back readable. Either the reply changed shape or ` +
      `namesFrom is too strict:\n${text.slice(0, 400)}`,
  );

  for (const { name } of names) {
    assert.ok(name.length >= 3 && name.length <= 80, `"${name}" is not a trading name`);
    assert.doesNotMatch(name, /^(here|these|i |the following|based on)/i, `"${name}" is prose`);
    assert.doesNotMatch(name, /\bsalon with\b|\bservices in\b/i, `"${name}" kept its description`);
  }
});
