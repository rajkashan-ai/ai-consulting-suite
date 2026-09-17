import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every fault, worst first.
 *
 * A record nobody reads is not a record. Everything the recorder captured was
 * invisible without SQL, which is exactly the position somebody was in on
 * 2026-09-16: reading the database by hand and getting it wrong twice.
 *
 * Staff only, and not linked from anywhere a customer sees. The table has no
 * select policy at all, so this reads through the admin client after checking
 * who is asking, rather than relying on a policy that does not exist.
 */
export const metadata = { title: "Problems" };
export const dynamic = "force-dynamic";

type Row = {
  fingerprint: string;
  message: string;
  where_at: string;
  kind: string;
  severity: string;
  action: string | null;
  outcome: string | null;
  release: string | null;
  interaction: string | null;
  seen: number;
  first_seen: string;
  last_seen: string;
  fixed_at: string | null;
};

/** Worst first, then most recent. Sorting is the first thing anybody does. */
const ORDER: Record<string, number> = { stopped: 0, fault: 1, noted: 2 };

const when = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
};

export default async function Problems() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  // Not "not allowed": a page a customer has no business knowing about is a
  // page that does not exist for them.
  if (!profile?.is_staff) redirect("/workspace");

  const { data } = await createAdminClient()
    .from("problems")
    .select("*")
    .order("last_seen", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Row[]).sort(
    (a, b) =>
      (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3) ||
      new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime(),
  );

  const open = rows.filter((r) => !r.fixed_at);

  return (
    <div className="band band--a band--first band--last">
      <div className="band__in">
        <h2 className="t-sub">Problems</h2>

        {!rows.length ? (
          <div className="panel">
            {/* Nothing recorded is a real answer and not an empty page. It can
                also mean the recorder is broken, which is worth saying out
                loud rather than letting silence read as good news. */}
            <h2 className="t-sub">Nothing recorded.</h2>
            <p className="t-doc">
              Either nothing has gone wrong, or nothing is reaching this table.
              The difference matters: check by causing one on purpose.
            </p>
          </div>
        ) : (
          <>
            <p className="t-meta">
              {open.length} open, {rows.length - open.length} marked fixed.
            </p>

            {/* tablewrap is the design system's horizontal scroller, so a wide
                table scrolls inside itself and the page never does. */}
            <div className="tablewrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>What</th>
                    <th>Where</th>
                    <th>Seen</th>
                    <th>First</th>
                    <th>Last</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.fingerprint}>
                      <td>
                        <span className="tag">{r.severity}</span>{" "}
                        {r.action ? `${r.action}: ` : ""}
                        {r.message}
                        {r.outcome ? <span className="t-meta"> ({r.outcome})</span> : null}
                      </td>
                      <td>
                        {r.where_at}
                        <span className="t-meta">
                          {" "}
                          {r.kind}
                          {r.release ? ` · ${r.release}` : ""}
                        </span>
                      </td>
                      {/* A count is the whole point: one row seen 40 times is a
                          different problem from 40 rows seen once. */}
                      <td>{r.seen}</td>
                      <td>{when(r.first_seen)}</td>
                      <td>{when(r.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
