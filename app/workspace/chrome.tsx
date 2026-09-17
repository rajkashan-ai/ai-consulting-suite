type Row = { id: string; name: string | null; website: string };

/**
 * The bar across the top. Pulled out of the page so the home screen and every
 * tool screen carry exactly the same one.
 *
 * The business chooser is staff only. A customer has one business, and
 * UI/CLAUDE.md section 7 forbids anything implying a second.
 */
export default function Chrome({
  staff,
  workspaces,
  current,
}: {
  staff: boolean;
  workspaces: Row[];
  current: Row;
}) {
  return (
    <header>
      <span className="logo">
        <span className="logo__mark" />
        Suite
      </span>

      {staff && workspaces.length > 1 && (
        <form className="chooser">
          <select
            name="w"
            className="field"
            defaultValue={current.id}
            aria-label="Which business you are testing"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name ?? w.website}
              </option>
            ))}
          </select>
          <button className="btn--sm btn--ghost" type="submit">
            Open
          </button>
        </form>
      )}

      {staff && (
        <a className="btn--sm btn--ghost" href="/welcome">
          Test another
        </a>
      )}

      {/* One style for the lot.
          These were three: a ghost button for "Test another", a plain tinted
          link for "Account", and a button dressed as that link for "Sign out".
          Three treatments for four controls that sit together and do the same
          kind of job, which reads as unfinished however carefully each one is
          drawn. Every one of them goes somewhere real, so nothing is removed. */}
      <a className="btn--sm btn--ghost" href="/account">
        Account
      </a>

      <form action="/auth/sign-out" method="post">
        <button className="btn--sm btn--ghost" type="submit">
          Sign out
        </button>
      </form>
    </header>
  );
}
