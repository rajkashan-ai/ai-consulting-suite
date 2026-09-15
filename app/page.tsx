import Link from "next/link";

/**
 * The public front door. Signed-in people never see it: middleware sends them
 * to their workspace. The selling landing page lives in UI/landing-page.html
 * and is not wired in yet, so this stays deliberately plain rather than
 * pretending to be it.
 */
export default function Home() {
  return (
    <main className="auth">
      <div className="auth__card">
        <p className="logo logo--dark">
          <span className="logo__mark" />
          Suite
        </p>
        <h1 className="t-display-3">AI tools that help you grow your business</h1>
        <p className="t-doc">
          Being tested with a small number of businesses. You need an invitation
          to get in.
        </p>
        <Link className="btn" href="/sign-in">
          Sign in
        </Link>
      </div>
    </main>
  );
}
