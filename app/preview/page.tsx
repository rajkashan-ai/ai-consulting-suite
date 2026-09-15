/**
 * Every screen on one page, so they can be looked at without four accounts,
 * a database, or a deploy.
 *
 * Deliberately not the live components. These are the same markup and the same
 * stylesheet with example content filled in, so nothing here can submit, save
 * or sign anybody in. It is for looking at, and it is labelled as such on the
 * page so nobody mistakes it for the product.
 */
export const metadata = { title: "Every screen" };

export default function Preview() {
  return (
    <div style={{ background: "var(--paper)" }}>
      <div className="mockbar">
        A look at every screen, with example content. Nothing here works. The
        real thing needs the four accounts in SETUP.md.
      </div>

      <Screen n="1" title="Signing in" note="What anyone invited sees first.">
        <div className="auth auth--inline">
          <div className="auth__card">
            <p className="logo logo--dark">
              <span className="logo__mark" />
              Suite
            </p>
            <h1 className="t-display-3">Sign in</h1>
            <p className="t-doc">
              No password. Either sign in with Google, or we send a six digit
              code to your email.
            </p>
            <div className="auth__form">
              <span className="btn btn--google">Continue with Google</span>
              <p className="auth__or t-meta">or</p>
              <label className="t-kind">Your email</label>
              <span className="field field--block field--filled">
                rajkashan@highintentlabs.com
              </span>
              <span className="btn--ghost">Email me a code</span>
            </div>
          </div>
        </div>
      </Screen>

      <Screen
        n="2"
        title="Setting up a business"
        note="One field. This is the whole of setup, and it is the screen you asked about."
      >
        <div className="onboard onboard--inline">
          <h1 className="t-display-3">Test a business</h1>
          <p className="t-doc">
            Any company&rsquo;s website. We read it and set up a workspace for
            them.
          </p>
          <div className="onboard__form">
            <label className="t-kind">Web address</label>
            <span className="field field--block field--filled">
              thebarbershopshrewsbury.co.uk
            </span>
            <span className="btn">Look at my site</span>
          </div>
        </div>
      </Screen>

      <Screen
        n="3"
        title="What we found"
        note="Every line is editable. This is where you correct us, and where a name field would go if you want one."
      >
        <div className="onboard onboard--inline">
          <h1 className="t-display-3">Is this right?</h1>
          <p className="t-doc">
            We read 4 pages of thebarbershopshrewsbury.co.uk. Change anything we
            got wrong.
          </p>
          <div className="found">
            <Row label="Business name" value="The Barber Shop Shrewsbury" />
            <Row label="What you do" value="barber" />
            <Row label="Where you are" value="Shrewsbury" />
            <Row
              label="In one line"
              value="A high street barber doing cuts and beard work, walk in or book online."
            />
            <div className="found__row">
              <span className="t-kind">Services we found</span>
              <ul className="cell-list">
                <li>Clipper cut £8</li>
                <li>Classic cut £15</li>
                <li>Beard trim £8</li>
                <li>Cut &amp; beard £20</li>
                <li>Beard sculpting £20</li>
              </ul>
            </div>
            <p className="t-meta">
              We could not find where you are on your site. Fill it in above and
              every tool will use it.
            </p>
            <div className="found__actions">
              <span className="btn">Yes, that is us</span>
              <span className="btn--ghost">Use a different address</span>
            </div>
          </div>
        </div>
      </Screen>

      <Screen
        n="4"
        title="The workspace"
        note="Your staff account gets the business chooser and Test another. A customer gets neither."
      >
        <div className="app app--inline">
          <header>
            <span className="logo">
              <span className="logo__mark" />
              Suite
            </span>
            <span className="chooser">
              <span className="field field--filled field--sm">
                The Barber Shop Shrewsbury
              </span>
              <span className="btn--sm btn--ghost">Open</span>
            </span>
            <span className="btn--sm btn--ghost">Test another</span>
            <span className="acct">Sign out</span>
          </header>
          <nav>
            {[
              "Home",
              "Competitor Tracker",
              "Content & Social Planner",
              "Proposal & Quote Builder",
            ].map((t, i) => (
              <span
                key={t}
                className="navitem"
                aria-current={i === 0 ? "page" : undefined}
              >
                {t}
              </span>
            ))}
            <span className="navitem t-quiet">and three more</span>
          </nav>
          <div className="band band--a band--first band--last">
            <div className="band__in">
              <h1 className="t-page">The Barber Shop Shrewsbury</h1>
              <p className="t-meta">Monday 15 September</p>
              <div>
                <h2 className="t-section">What moved</h2>
                <div className="panel">
                  <h3 className="t-sub">Nothing to compare yet.</h3>
                  <p className="t-doc">
                    Nothing has run for The Barber Shop Shrewsbury yet. Open the
                    Competitor Tracker and we will write down where everyone
                    stands today, then tell you what moved next Monday.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Screen>

      <Screen
        n="5"
        title="Turned away"
        note="Anyone not on the list. No account is created for them."
      >
        <div className="auth auth--inline">
          <div className="auth__card">
            <p className="logo logo--dark">
              <span className="logo__mark" />
              Suite
            </p>
            <h1 className="t-display-3">Not open yet</h1>
            <p className="t-doc">
              This is being tested with a small number of businesses. Your
              account was not created and nothing was saved.
            </p>
            <span className="btn">Try again</span>
          </div>
        </div>
      </Screen>

      <Screen
        n="6"
        title="Your account"
        note="Download everything, or delete everything. Both are legal requirements."
      >
        <div className="band band--a band--first band--last">
          <div className="band__in">
            <h1 className="t-page">Your account</h1>
            <div>
              <h2 className="t-section">What we hold</h2>
              <div className="panel">
                <dl className="kv">
                  <dt className="t-kind">Signed in as</dt>
                  <dd className="t-row">rajkashan@highintentlabs.com</dd>
                  <dt className="t-kind">How you sign in</dt>
                  <dd className="t-row">Google. We never see a password</dd>
                  <dt className="t-kind">Businesses</dt>
                  <dd className="t-row">3</dd>
                  <dt className="t-kind">Documents</dt>
                  <dd className="t-row">0</dd>
                </dl>
              </div>
            </div>
            <div>
              <h2 className="t-section">Close your account</h2>
              <div className="panel">
                <p className="t-doc">
                  This deletes your account, your business, every document and
                  every source. It happens immediately and we cannot undo it.
                </p>
                <div className="auth__form">
                  <label className="t-kind">Type delete to confirm</label>
                  <span className="field field--sm" />
                  <span className="btn--ghost btn--danger">
                    Delete everything
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Screen>
    </div>
  );
}

function Screen({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="shot">
      <div className="shot__head">
        <span className="shot__no">{n}</span>
        <div>
          <h2 className="t-sub">{title}</h2>
          <p className="t-meta">{note}</p>
        </div>
      </div>
      <div className="shot__frame">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="found__row">
      <span className="t-kind">{label}</span>
      <span className="field field--block field--filled">{value}</span>
    </div>
  );
}
