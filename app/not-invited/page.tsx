export const metadata = { title: "Not open yet" };

/**
 * Deliberately says nothing about who is on the list or how to get on it. It is
 * a closed door, not a puzzle, and a page that explains the rule is a page that
 * teaches somebody how to work around it.
 */
export default function NotInvited() {
  return (
    <main className="auth">
      <div className="auth__card">
        <p className="logo logo--dark">
          <span className="logo__mark" />
          Suite
        </p>
        <h1 className="t-display-3">Not open yet</h1>
        <p className="t-doc">
          This is being tested with a small number of businesses. Your account
          was not created and nothing was saved.
        </p>
        <p className="t-doc-sm">
          If you were expecting to get in, the email you used is probably not
          the one on the list. Try the other one.
        </p>
        <a className="btn" href="/sign-in">
          Try again
        </a>
      </div>
    </main>
  );
}
