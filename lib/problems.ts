import { createHash } from "node:crypto";
// Relative, not "@/". The alias resolves under Next and under tsx, and not
// under the plain test runner that `npm test` uses, so a module that must be
// tested cannot use it. lib/engine.ts can, because it is server-only and is
// exercised through the pipeline rather than directly.
import { redact } from "./privacy/redact.ts";

/**
 * Where a fault goes.
 *
 * The decision, and the standards behind every rule here, are in
 * ERROR-HANDLING.md. This is the implementation of rules 3 and 5.
 *
 * Two jobs a log line cannot do:
 *
 *   - Say who and where without holding an email, an IP or a token.
 *   - Say whether a fault is STILL happening, which needs the same fault to
 *     land on the same row with a count, not a new line every time.
 *
 * Never throws. A recorder that can fail is a second fault on top of the first,
 * and it would fire at exactly the moment everything is already going wrong.
 */

export type Kind = "render" | "route" | "action" | "run" | "client";

export type Problem = {
  error: unknown;
  /** A route path, or a tool and stage. Never a stack trace: see below. */
  where: string;
  kind: Kind;
  /** Next gives this for an error React has already processed. */
  digest?: string | null;
  workspaceId?: string | null;
  runId?: string | null;
};

/** The database, as much of it as this needs. */
export type Notes = {
  rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
};

/**
 * The message, with everything that varies between two of the same fault
 * taken out.
 *
 * Numbers, uuids, urls, quoted strings and hex all go. "Run 3f2a failed after
 * 412 seconds" and "Run 91bc failed after 38 seconds" are one fault, and if
 * they land on two rows the count is meaningless, which is the only thing this
 * table is for.
 */
export function shapeOf(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/"[^"]*"|'[^']*'/g, "<quoted>")
    .replace(/\b[0-9a-f]{7,}\b/g, "<hex>")
    .replace(/\d+([.,]\d+)?/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Same fault, same key. Built from what it was and where, and nothing else. */
export function fingerprint(message: string, where: string, kind: Kind): string {
  return createHash("sha256")
    .update(`${kind}|${where}|${shapeOf(message)}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * What we are willing to keep, out of whatever was thrown.
 *
 * A stack trace is deliberately not kept. It carries absolute file paths, and
 * on a self-hosted install that is somebody's home directory, which OWASP's
 * never-log list covers under sensitive data. The message and the place are
 * enough to find anything, and if they are not, the fix is a better message.
 */
export function messageOf(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              // An object that will not serialise, usually circular. Its type is
              // still worth having, and this is the only thing left to say.
              return Object.prototype.toString.call(error);
            }
          })();

  // Everything on OWASP's never-log list that can appear in free text. Applied
  // here so no caller has to remember, and so a message that arrives already
  // carrying an email cannot reach the table.
  return redact(String(raw ?? "").slice(0, 2_000)).text;
}

/**
 * Write it down. Never throws, whatever happens.
 *
 * Returns the fingerprint on success and null when it could not record, so a
 * caller that wants to say "we have logged this" can tell whether that is true.
 */
export async function note(db: Notes, p: Problem): Promise<string | null> {
  try {
    const message = messageOf(p.error);
    const where = redact(String(p.where ?? "unknown").slice(0, 300)).text;
    const key = fingerprint(message, where, p.kind);

    await db.rpc("note_problem", {
      p_fingerprint: key,
      p_message: message,
      p_where: where,
      p_kind: p.kind,
      p_digest: p.digest ?? null,
      p_workspace: p.workspaceId ?? null,
      p_run: p.runId ?? null,
    });

    return key;
  } catch {
    /**
     * The recorder failing is the one place silence is right.
     *
     * It fires when something has already gone wrong, and throwing here would
     * replace a fault we could have recorded with a second one we cannot. The
     * caller gets null and carries on doing what it was doing.
     *
     * This is the fourth case in ERROR-HANDLING.md rule 1: expected, and said
     * so out loud.
     */
    return null;
  }
}
