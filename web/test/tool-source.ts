import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every source file of one tool, as one string.
 *
 * Several tests check the wording of a prompt or the cap in a schema by reading
 * the source, because the runner cannot import a module that pulls in
 * server-only code. They each read `stages.ts` by name, so when the prompts and
 * schemas moved out of it on 2026-09-17 six of them failed: not because
 * anything was wrong, but because they were pinned to a file rather than to the
 * thing they were checking.
 *
 * What they mean is "somewhere in this tool", so that is what this returns.
 * Moving a declaration between files in a tool's own folder is the tool's
 * business and should not be a change every test has to follow.
 */
export function sourceOf(tool: string): string {
  const dir = join(import.meta.dirname, "..", "tools", tool);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}


/**
 * A tool's spec: its CLAUDE.md and everything in its references folder.
 *
 * The third time this lesson has been paid for in two days. A test pinned to
 * one filename breaks when a section moves, not because anything is wrong but
 * because it was checking the wrong thing: what it means is "the spec says X",
 * and the spec is a folder now.
 *
 * Long specs get split, because Anthropic's guidance is to target under 200
 * lines and a longer file reduces adherence to itself. Splitting one should not
 * be a change every test has to follow.
 */
export function specOf(tool: string): string {
  const dir = join(import.meta.dirname, "..", "..", "Agents", tool);
  const parts = [readFileSync(join(dir, "CLAUDE.md"), "utf8")];

  const refs = join(dir, "references");
  if (existsSync(refs)) {
    for (const f of readdirSync(refs).filter((n) => n.endsWith(".md")).sort()) {
      parts.push(readFileSync(join(refs, f), "utf8"));
    }
  }
  return parts.join("\n");
}
