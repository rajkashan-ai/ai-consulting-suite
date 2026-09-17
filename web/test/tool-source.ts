import { readFileSync, readdirSync } from "node:fs";
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
