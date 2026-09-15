"use client";

import { useActionState } from "react";
import { confirm, detect, startAgain, type WelcomeState } from "./actions";

/**
 * One field, then what we found.
 *
 * A one-field form converted at 18.2 per cent against 11.5 for three fields,
 * which is why the trade, the town and the sentence are not asked for here.
 * They are worked out and shown back, so the customer's first act is correcting
 * us rather than filling in a form, and the first thing they see is the product
 * already knowing their business.
 */
export default function Welcome({ staff }: { staff: boolean }) {
  const [state, run, pending] = useActionState<WelcomeState, FormData>(detect, {
    stage: "start",
  });

  if (state.stage === "found") {
    return (
      <div>
        <h1 className="t-display-3">Is this right?</h1>
        <p className="t-doc">
          We read {state.pagesRead} {state.pagesRead === 1 ? "page" : "pages"} of{" "}
          {state.website}. Change anything we got wrong.
        </p>

        <form action={confirm} className="found">
          <input type="hidden" name="workspaceId" value={state.workspaceId} />

          <Row label="Business name" name="name" value={state.name} />
          <Row label="What you do" name="trade" value={state.trade} />
          <Row label="Where you are" name="town" value={state.town} />
          <Row label="In one line" name="oneLiner" value={state.oneLiner} />

          {state.services.length > 0 && (
            <div className="found__row">
              <span className="t-kind">Services we found</span>
              <ul className="cell-list">
                {state.services.map((s) => (
                  <li key={s.name}>
                    {s.name}
                    {s.price ? ` ${s.price}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.missing.length > 0 && (
            <p className="t-meta">
              We could not find {list(state.missing)} on your site. Fill it in
              above and every tool will use it.
            </p>
          )}

          <div className="found__actions">
            <button className="btn" type="submit">
              Yes, that is us
            </button>
            <button className="btn--ghost" type="submit" formAction={startAgain}>
              Use a different address
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="t-display-3">
        {staff ? "Test a business" : "Let us look at your business"}
      </h1>
      <p className="t-doc">
        {staff
          ? "Any company's website. We read it and set up a workspace for them."
          : "Put in your web address. We read it and tell you what we found, then you tell us what we got wrong. That is the whole setup."}
      </p>

      <form action={run} className="onboard__form">
        <label className="t-kind" htmlFor="website">
          Web address
        </label>
        <input
          id="website"
          name="website"
          className="field field--block"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourbusiness.co.uk"
          required
          autoFocus
        />
        {state.error && <p className="auth__error t-doc-sm">{state.error}</p>}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Reading your site" : "Look at my site"}
        </button>
        {pending && (
          <p className="t-meta">
            This takes about twenty seconds. We read a few pages slowly, one at a
            time, so we are never a burden on a small site.
          </p>
        )}
      </form>

      {!staff && (
        <p className="t-meta" style={{ marginTop: "var(--s6)" }}>
          No website? Type your trade and your town instead, like
          &ldquo;barber Shrewsbury&rdquo;.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="found__row">
      <label className="t-kind" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="field field--block"
        defaultValue={value}
        placeholder="We could not find this"
      />
    </div>
  );
}

function list(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
