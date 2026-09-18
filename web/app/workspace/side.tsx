"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOLS } from "@/tools/registry";
import { withoutTown } from "@/tools/place";

/**
 * Down the side, which reverses the note that used to sit here.
 *
 * "Across the top, never a sidebar" was right while the nav carried four words
 * and nothing else. The Instrument handoff of 2026-09-18 gives it a job it
 * could not do lying down: each tool carries its own live state beside its
 * name, and a state that changes while you are looking at it needs somewhere
 * that is always on screen.
 *
 * Real links, so each tool keeps its own web address to bookmark, share or
 * reload. `aria-current` drives the drawn state, so what a screen reader says
 * and what you can see cannot drift apart.
 *
 * WHAT CHANGED ABOUT UNBUILT TOOLS
 * They used to be left out, because "six headings where four lead to not built
 * yet reads as a product that mostly does not work". They are in now, and say
 * `soon` in mono, because the handoff is right that a shape you can see is
 * honest and a gap you cannot is not. The two furthest from real are still
 * hidden: `hidden` in the registry is a different claim from `built: false`.
 */

/** Two letters, because six tools share three first letters. A placeholder for
 *  an icon set we do not have, and the handoff says so in as many words. */
const initials = (name: string): string =>
  name
    .replace(/&/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export default function Side({
  workspaceId,
  name,
  town,
  savedLabel,
  savedSub,
}: {
  workspaceId: string;
  name: string;
  town: string | null;
  /** The one figure this business has earned. Null until a run has happened. */
  savedLabel: string | null;
  savedSub: string;
}) {
  const path = usePathname();
  const q = `?w=${workspaceId}`;

  const items = [
    { href: `/workspace${q}`, at: "/workspace", label: "Home", key: "HO", state: null },
    ...TOOLS.filter((t) => !t.hidden).map((t) => ({
      href: `/workspace/${t.slug}${q}`,
      at: `/workspace/${t.slug}`,
      label: t.short,
      key: initials(t.short),
      state: t.built ? null : "soon",
    })),
  ];

  return (
    <aside className="side">
      <div className="side__id">
        <span className="side__mark" aria-hidden="true">
          {(name.trim()[0] ?? "?").toUpperCase()}
        </span>
        <span className="side__who">
          {/**
           * The town comes off the second line, so it is not said twice.
           *
           * "A Cut Above St Albans" is 151px in a 137px box and ellipsised to
           * "A Cut Above St Alb…", which loses the half that identifies them
           * while repeating the half already below it. Trimmed only when the
           * name actually ends in the town: a salon genuinely called
           * "St Albans Hair" keeps its name.
           */}
          <span className="side__name">{withoutTown(name, town)}</span>
          {town ? <span className="side__where">{town}</span> : null}
        </span>
      </div>

      <nav className="side__nav" aria-label="Your tools">
        {items.map((item) => {
          const here = path === item.at;
          /* Not a link while it does not exist. A control that goes nowhere is
             the "Approve this week" button again, and this screen has paid for
             that lesson twice. */
          if (item.state) {
            return (
              <span className="navitem navitem--off" key={item.label}>
                <span className="navitem__chip" aria-hidden="true">{item.key}</span>
                <span className="navitem__label" title={item.label}>{item.label}</span>
                <span className="navitem__state">{item.state}</span>
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className="navitem"
              aria-current={here ? "page" : undefined}
            >
              <span className="navitem__chip" aria-hidden="true">{item.key}</span>
              <span className="navitem__label" title={item.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pinned to the bottom. The one figure that is about them rather than
          about us, and it says nothing at all until a run has produced one. */}
      <div className="side__saved">
        <span className="t-kind">this month</span>
        <span className="side__saved-n">{savedLabel ?? "nothing yet"}</span>
        <span className="side__saved-w">{savedSub}</span>
      </div>
    </aside>
  );
}
