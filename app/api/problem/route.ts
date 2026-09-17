import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { note, type Kind, type Severity } from "@/lib/problems";

/**
 * Where a crash in the browser is reported.
 *
 * `error.tsx` is a Client Component, which the Next.js docs require, so it
 * cannot reach the database itself. It posts here instead.
 *
 * Treated as untrusted input throughout, because anybody can post to it. The
 * message is redacted and truncated like any other, the kind is checked against
 * a list rather than taken as given, and nothing here reads or returns a row.
 * The worst somebody can do is add noise to a table only we look at.
 */

const KINDS = new Set<Kind>(["render", "route", "action", "run", "client"]);
const SEVERITIES = new Set<Severity>(["stopped", "fault", "noted"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: unknown;
      digest?: unknown;
      where?: unknown;
      kind?: unknown;
      severity?: unknown;
      workspaceId?: unknown;
    };

    const kind = KINDS.has(body.kind as Kind) ? (body.kind as Kind) : "client";
    const severity = SEVERITIES.has(body.severity as Severity)
      ? (body.severity as Severity)
      : "fault";
    const uuid = /^[0-9a-f-]{36}$/i;

    await note(createAdminClient() as never, {
      error: String(body.message ?? "something went wrong in the browser"),
      where: String(body.where ?? "unknown"),
      kind,
      severity,
      digest: typeof body.digest === "string" ? body.digest.slice(0, 120) : null,
      workspaceId:
        typeof body.workspaceId === "string" && uuid.test(body.workspaceId)
          ? body.workspaceId
          : null,
    });
  } catch {
    // Reporting a fault must never itself fail visibly: the caller is already
    // showing somebody an error page. ERROR-HANDLING.md rule 1, fourth case.
  }

  // Always the same answer. Nothing about whether it was recorded, because the
  // browser can do nothing with that and it is one more thing to probe.
  return NextResponse.json({ ok: true });
}
