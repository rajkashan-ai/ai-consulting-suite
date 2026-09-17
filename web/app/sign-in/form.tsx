"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { readable } from "./messages";
import { report } from "../report";

/**
 * Two ways in, and no password in either.
 *
 * A password is the one credential we could lose. We never take one, so there
 * is nothing to store, nothing to reset, and credential stuffing has nothing to
 * stuff. Google verifies the person, or a six digit code proves they can read
 * the inbox they claim.
 *
 * The code is typed here rather than clicked in an email on purpose. Corporate
 * mail scanners follow links in messages before a person ever sees them, which
 * silently consumes a one-time link and produces a login that fails for no
 * visible reason. A code that has to be typed cannot be spent by a robot.
 */

type Stage = "start" | "code-sent" | "working";

export default function SignInForm() {
  const params = useSearchParams();
  const raw = params.get("next") ?? "/workspace";
  // Only ever somewhere inside this site. Without this, a link could sign
  // somebody in and then bounce them to another site carrying our name.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/workspace";

  const [stage, setStage] = useState<Stage>("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  /**
   * Built inside each handler, never during render. Building it during render
   * meant a missing setting threw while the page was drawing, so the whole
   * screen was replaced by "This page couldn't load" and the form never
   * appeared to say what was wrong.
   */
  const connect = () => createClient();

  /** Every handler funnels through here, so a thrown error becomes a sentence
   *  on the form rather than escaping to the error boundary. */
  async function attempt(job: () => Promise<string | null>, back: Stage) {
    setError(null);
    setStage("working");
    try {
      // A job may set its own message and return null, meaning "handled, and
      // what I said stands". Only a returned string is turned into an error.
      const problem = await job();
      if (problem) {
        setError(readable(problem));
        setStage(back);
      }
    } catch (thrown) {
      /**
       * A customer who cannot sign in produced no record anywhere.
       *
       * OWASP lists authentication failures as a thing to log, and this is the
       * one failure where the person affected cannot tell us: they are not in
       * yet. `readable()` turns it into their words; this keeps ours.
       */
      report(thrown, "sign in", null, "stopped");
      setError(readable(thrown instanceof Error ? thrown.message : String(thrown)));
      setStage(back);
    }
  }

  const withGoogle = () =>
    attempt(async () => {
      const { error } = await connect().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      return error?.message ?? null;
      // No success branch. The browser is already on its way to Google.
    }, "start");

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    return attempt(async () => {
      const { error } = await connect().auth.signInWithOtp({
        email: email.trim(),
        // The allowlist is enforced in the database, not here. This only avoids
        // creating an auth user for somebody who was never getting in.
        options: { shouldCreateUser: true },
      });

      // Being told to slow down is not a dead end. A code from a few minutes
      // ago is still good for an hour, and the only way to type one was to
      // trigger an email first, which is the request that just got refused.
      if (error && /rate|many|seconds|limit/i.test(error.message)) {
        setStage("code-sent");
        setError(
          "We could not send another just yet. If you already have a code, " +
            "from an earlier email or from the terminal, type it here.",
        );
        return null;
      }

      if (error) return error.message;
      setStage("code-sent");
      return null;
    }, "start");
  };

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    return attempt(async () => {
      const { error } = await connect().auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) return error.message;
      window.location.assign(next);
      return null;
    }, "code-sent");
  };

  if (stage === "code-sent" || (stage === "working" && code)) {
    return (
      <form onSubmit={checkCode} className="auth__form">
        <p className="t-doc-sm">
          We sent a six digit code to <strong>{email}</strong>. It is good for
          one hour.
        </p>
        <label className="t-kind" htmlFor="code">
          The code
        </label>
        <input
          id="code"
          className="field field--block"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {error && <p className="auth__error t-doc-sm">{error}</p>}
        <button className="btn" type="submit" disabled={stage === "working"}>
          {stage === "working" ? "Checking" : "Sign in"}
        </button>
        <button
          className="btn--ghost"
          type="button"
          onClick={() => {
            setStage("start");
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <div className="auth__form">
      <button
        className="btn btn--google"
        type="button"
        onClick={withGoogle}
        disabled={stage === "working"}
      >
        <GoogleMark />
        Continue with Google
      </button>

      <p className="auth__or t-meta">or</p>

      <form onSubmit={sendCode} className="auth__form">
        <label className="t-kind" htmlFor="email">
          Your email
        </label>
        <input
          id="email"
          className="field field--block"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className="auth__error t-doc-sm">{error}</p>}
        <button className="btn--ghost" type="submit" disabled={stage === "working"}>
          {stage === "working" ? "Sending" : "Email me a code"}
        </button>
        {/* The code box used to be reachable only by sending an email. When the
            email was refused, or arrived as a link, or arrived an hour late,
            there was no way to type a code you already had. */}
        <button
          className="auth__already t-meta"
          type="button"
          onClick={() => {
            setError(null);
            setStage("code-sent");
          }}
        >
          I already have a code
        </button>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
