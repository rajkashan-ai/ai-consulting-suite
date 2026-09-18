import Side from "./side";

type Row = { id: string; name: string | null; website: string; town?: string | null };

/**
 * The frame every workspace screen sits in.
 *
 * One component rather than three parts each page assembles, because the home
 * screen and the tool screens assembled them separately and a change to the
 * frame had to be made twice. It was made twice; they did not drift, which was
 * luck rather than design.
 *
 * WHAT IS WHERE, AND WHY
 * The sidebar carries identity and the tools, because those do not change while
 * you work. The top bar carries the date and the controls that leave: account,
 * sign out, and the staff-only business chooser. A customer has one business,
 * and UI/CLAUDE.md section 7 forbids anything implying a second, so the chooser
 * is staff only and always was.
 */
export default function Shell({
  staff,
  workspaces,
  current,
  today,
  savedLabel,
  savedSub,
  children,
}: {
  staff: boolean;
  workspaces: Row[];
  current: Row;
  /** Written by the caller, which already knows the timezone rule. */
  today: string;
  savedLabel: string | null;
  savedSub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Side
        workspaceId={current.id}
        name={current.name ?? current.website}
        town={current.town ?? null}
        savedLabel={savedLabel}
        savedSub={savedSub}
      />

      <div className="frame">
        <header className="topbar">
          <span className="t-kind topbar__when">{today}</span>

          <div className="topbar__acts">
            {staff && workspaces.length > 1 && (
              <form className="chooser">
                <select
                  name="w"
                  className="field field--sm"
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

            {/* One style for the lot. These were three treatments for four
                controls that sit together and do the same kind of job, which
                reads as unfinished however carefully each one is drawn. */}
            <a className="btn--sm btn--ghost" href="/account">
              Account
            </a>

            <form action="/auth/sign-out" method="post">
              <button className="btn--sm btn--ghost" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
