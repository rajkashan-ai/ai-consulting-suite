import { notFound } from "next/navigation";
import TryForm from "./form";

export const metadata = { title: "Read a website" };

/**
 * The reading step on its own: no sign-in, no database, no Supabase.
 *
 * It exists because everything behind the login is currently empty, so the only
 * thing worth testing today is whether we read a business correctly. Guarding
 * that behind an account somebody has to create first is friction for nothing.
 *
 * Development only. It spends real money on whatever URL it is given.
 */
export default function Try() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) notFound();

  return (
    <main className="onboard">
      <div className="mockbar" style={{ marginBottom: "var(--s7)" }}>
        On your machine only. No sign-in, nothing saved, and this page does not
        exist on a deployed site.
      </div>
      <h1 className="t-display-3">Read a website</h1>
      <p className="t-doc">
        The one part of the product that works today. Put in any company and see
        what we get back, and what we could not find.
      </p>
      <TryForm />
    </main>
  );
}
