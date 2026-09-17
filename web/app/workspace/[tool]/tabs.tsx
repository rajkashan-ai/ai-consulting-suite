"use client";

import { useState } from "react";

/**
 * Tabs driven by aria-selected and the hidden attribute, so what a screen
 * reader announces and what is drawn cannot drift apart.
 */
export default function Tabs({
  tabs,
}: {
  tabs: { id: string; label: string; panel: React.ReactNode }[];
}) {
  const [on, setOn] = useState(tabs[0]?.id);

  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            className="tab"
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={on === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setOn(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          className="tabpanel"
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={on !== t.id}
        >
          {t.panel}
        </div>
      ))}
    </>
  );
}
