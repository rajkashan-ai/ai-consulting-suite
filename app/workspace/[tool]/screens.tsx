import type { ComponentType } from "react";
import CompetitorTracker from "./competitor-tracker";
import ContentSocialPlanner from "./content-social-planner";

/**
 * Which screen a built tool gets, by slug.
 *
 * The same fix `tools/contract.ts` made to the engine, one layer up and for the
 * same reason. The tool page imported the Competitor Tracker by name and
 * rendered it for any tool marked built, so `built: true` on the second tool
 * would have shown the Tracker's panel on the Planner's page, read the
 * Tracker's runs, and started a Tracker run on the first click. Worse than a
 * blank screen, because it looks like it worked.
 *
 * It was invisible: `test/contract.test.ts` proves the engine names no tool and
 * reads only `lib/engine.ts`. Nothing looked at the screen.
 *
 * One line per tool, the way the registry has one line per runner. The
 * readiness rules are in `ready.ts` so a test can run them.
 */

export const SCREENS: Record<string, ComponentType<{ workspaceId: string; ready: boolean }>> = {
  "competitor-tracker": CompetitorTracker,
  "content-social-planner": ContentSocialPlanner,
};

/**
 * Tools that emit their own bands.
 *
 * A band is a change of ground, and it is the only landmark this system gives a
 * reader for "you are in a different part of the page". The Planner has seven
 * sections and needs four of them; the Tracker is a tabbed page with no natural
 * joins and wants one band around the lot, which is what the page provides by
 * default.
 */
export const LAYS_OUT_ITS_OWN_BANDS = ["content-social-planner"];

export const screenFor = (slug: string) => SCREENS[slug] ?? null;
