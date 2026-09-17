"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Close the account and delete everything.   Article 17.
 *
 * Irreversible, so it asks the person to type the word rather than press a
 * button they could hit by accident. The check is here on the server: a
 * confirmation enforced only in the browser is not a confirmation.
 */
export async function deleteEverything(form: FormData): Promise<void> {
  const typed = String(form.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== "delete") {
    redirect("/account?error=confirm");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // One call. It deletes the auth user, and every table cascades from there,
  // so nothing can be missed by a list that was not kept up to date.
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/account?error=failed");

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
