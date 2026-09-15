"use client";

import { useState } from "react";

/**
 * Across the top, never a sidebar. Bonsai does it this way and Raj settled it
 * on 14 September, twice.
 *
 * aria-current drives the drawn state, so the accessible name and what you can
 * see cannot drift apart.
 */
export default function Nav({ tools }: { tools: string[] }) {
  const [on, setOn] = useState("Home");
  const items = ["Home", ...tools, "Documents", "Your business"];

  return (
    <nav>
      {items.map((name) => (
        <button
          key={name}
          className="navitem"
          type="button"
          aria-current={on === name ? "page" : undefined}
          onClick={() => setOn(name)}
        >
          {name}
        </button>
      ))}
    </nav>
  );
}
