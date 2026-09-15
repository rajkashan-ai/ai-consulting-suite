import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Welcome from "./form";

export const metadata = { title: "Set up" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  const staff = profile?.is_staff ?? false;

  // A customer has one business and cannot have a second. Staff may add
  // another, which is what the test mode is for. The rule lives here rather
  // than in the interface, so hiding a button is not what enforces it.
  if (!staff) {
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .not("confirmed_at", "is", null)
      .limit(1);
    if (existing?.length) redirect("/workspace");
  }

  return (
    <main className="onboard">
      <Welcome staff={staff} />
    </main>
  );
}
