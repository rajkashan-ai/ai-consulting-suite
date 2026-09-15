/**
 * Every screen on one page, so they can be looked at without four accounts,
 * a database, or a deploy.
 *
 * Deliberately not the live components. These are the same markup and the same
 * stylesheet with example content filled in, so nothing here can submit, save
 * or sign anybody in. It is for looking at, and it is labelled as such on the
 * page so nobody mistakes it for the product.
 */
import { TOOLS } from "@/tools/registry";

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
        note="Where you land after entering a website. Your staff account gets the business chooser and Test another. A customer gets neither."
      >
        <div className="app app--inline">
          <Bar />
          <NavBar on="Home" />
          <div className="band band--a band--first">
            <div className="band__in">
              <h1 className="t-page">The Barber Shop Shrewsbury</h1>
              <p className="t-meta">Monday 15 September</p>
              <div>
                <h2 className="t-section">What we know about you</h2>
                <div className="panel">
                  <dl className="kv">
                    <dt className="t-kind">Website</dt>
                    <dd className="t-row">thebarbershopshrewsbury.co.uk</dd>
                    <dt className="t-kind">What you do</dt>
                    <dd className="t-row">barber</dd>
                    <dt className="t-kind">Where</dt>
                    <dd className="t-row">Shrewsbury</dd>
                  </dl>
                  <p className="t-meta">
                    Read off your own site. Every tool works from this, so wrong
                    here means wrong everywhere.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="band band--b band--last">
            <div className="band__in">
              <h2 className="t-section">Your tools</h2>
              <p className="t-doc">
                None of them are written yet. Each one opens, says so, and shows
                what it will be given when somebody builds it.
              </p>
              <ul className="tools">
                {TOOLS.map((t) => (
                  <li key={t.slug}>
                    <span className="tools__row">
                      <span className="t-card">{t.name}</span>
                      <span className="t-meta">{t.does}</span>
                      <span className="t-kind kind--warn">Not built</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Screen>

      <Screen
        n="5"
        title="Opening a tool that is not written yet"
        note="This is what all six do today. It says so, rather than showing an empty screen that looks broken."
      >
        <div className="app app--inline">
          <Bar />
          <NavBar on="Competitor Tracker" />
          <div className="band band--a band--first band--last">
            <div className="band__in">
              <h1 className="t-page">Competitor Tracker</h1>
              <p className="t-doc">
                Who you are up against, what they charge, and what to do about
                it.
              </p>
              <div className="panel">
                <h2 className="t-sub">This one is not built yet.</h2>
                <p className="t-doc">
                  Nothing runs here. When it is written it will read
                  thebarbershopshrewsbury.co.uk and work from what a barber
                  needs, in Shrewsbury.
                </p>
                <p className="t-meta">
                  Everything around it works: signing in, which business is
                  open, reading pages, storing what came back and showing it.
                  What is missing is this tool&rsquo;s own job.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Screen>

      <Screen
        n="6"
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
        n="7"
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

function Bar() {
  return (
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
      <span className="acct">Account</span>
      <span className="acct">Sign out</span>
    </header>
  );
}

function NavBar({ on }: { on: string }) {
  return (
    <nav>
      {["Home", ...TOOLS.map((t) => t.name)].map((name) => (
        <span
          key={name}
          className="navitem"
          aria-current={name === on ? "page" : undefined}
        >
          {name}
        </span>
      ))}
    </nav>
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
