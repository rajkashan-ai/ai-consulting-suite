"use client";

import { useActionState } from "react";
import { tryRead, type TryState } from "./actions";

export default function TryForm() {
  const [state, run, pending] = useActionState<TryState, FormData>(tryRead, {
    stage: "start",
  });

  return (
    <>
      <form action={run} className="onboard__form">
        <label className="t-kind" htmlFor="website">
          Any company&rsquo;s web address
        </label>
        <input
          id="website"
          name="website"
          className="field field--block"
          type="text"
          inputMode="url"
          placeholder="thebarbershopshrewsbury.co.uk"
          required
          autoFocus
          defaultValue={state.stage === "found" ? state.website : ""}
        />
        {state.stage === "start" && state.error && (
          <p className="auth__error t-doc-sm">{state.error}</p>
        )}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Reading their site" : "Read it"}
        </button>
        {pending && (
          <p className="t-meta">
            About twenty seconds. We read a few pages one at a time, with a pause
            between, so we are never a burden on a small site.
          </p>
        )}
      </form>

      {state.stage === "found" && (
        <>
          <div className="found">
            <Row label="Business name" value={state.name} />
            <Row label="What they do" value={state.trade} />
            <Row label="Where they are" value={state.town} />
            <Row label="In one line" value={state.oneLiner} />

            <div className="found__row">
              <span className="t-kind">Services with prices</span>
              {state.services.length ? (
                <ul className="cell-list">
                  {state.services.map((s) => (
                    <li key={s.name}>
                      {s.name}
                      {s.price ? ` ${s.price}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="cell-none">
                  Their site publishes none. That is worth knowing.
                </span>
              )}
            </div>
          </div>

          <h2 className="t-section">What it actually read</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Result</th>
                  <th>Words read</th>
                </tr>
              </thead>
              <tbody>
                {state.pages.map((p) => (
                  <tr key={p.url}>
                    <td>{p.url}</td>
                    <td>
                      {p.ok ? (
                        <span className="t-kind kind--good">Read</span>
                      ) : (
                        <>
                          <span className="t-kind kind--warn kind--block">
                            Not read
                          </span>
                          {p.note}
                        </>
                      )}
                    </td>
                    <td>{p.ok ? Math.round(p.chars / 5).toLocaleString() : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-meta">
            {state.seconds} seconds. {state.tokens.input.toLocaleString()} tokens
            in, {state.tokens.output.toLocaleString()} out. This is the number the
            fair use cap will eventually be set from.
          </p>
        </>
      )}
    </>
  );
}

/** A blank says so. It never guesses, and that is the thing to test here. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="found__row">
      <span className="t-kind">{label}</span>
      {value ? (
        <span className="t-row">{value}</span>
      ) : (
        <span className="cell-none">Not on their site, so we left it blank</span>
      )}
    </div>
  );
}
