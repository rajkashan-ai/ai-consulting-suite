import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything we hold about you, as a file.   Articles 15 and 20.
 *
 * The gathering happens in the database (export_my_data), not here, so adding a
 * table and forgetting to add it to the export is one change in one place
 * rather than two that can drift.
 *
 * GET is right for this one, unlike sign-out: it returns data and changes
 * nothing. It cannot leak to another site either, because a cross-site request
 * carries no session cookie and gets nothing back.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });

  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return new NextResponse("Could not build your export.", { status: 500 });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="your-data-${day}.json"`,
      // Never let this sit in a shared cache. It is one person's whole record.
      "cache-control": "no-store, private",
    },
  });
}
