"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOLS } from "@/tools/registry";

/**
 * Across the top, never a sidebar.
 *
 * Real links, so each tool has its own web address you can bookmark, share or
 * reload. aria-current drives the drawn state, so what a screen reader says and
 * what you can see cannot drift apart.
 */
export default function Nav({ workspaceId }: { workspaceId: string }) {
  const path = usePathname();
  const q = `?w=${workspaceId}`;

  const items = [
    { href: `/workspace${q}`, name: "Home", exact: true },
    /**
     * Hidden tools are not in the navigation.
     *
     * An unbuilt tool in the header is a promise. Six headings where four lead
     * to "not built yet" reads as a product that mostly does not work, so the
     * ones furthest from being real are kept out until they are.
     */
    ...TOOLS.filter((t) => !t.hidden).map((t) => ({
      href: `/workspace/${t.slug}${q}`,
      name: t.name,
      exact: false,
    })),
  ];

  return (
    <nav>
      {items.map((item) => {
        const here = item.exact
          ? path === "/workspace"
          : path === item.href.split("?")[0];
        return (
          <Link
            key={item.name}
            href={item.href}
            className="navitem"
            aria-current={here ? "page" : undefined}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
