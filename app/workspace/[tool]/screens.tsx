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

export const screenFor = (slug: string) => SCREENS[slug] ?? null;
