import type { Tool } from "./types.ts";
import type { AnyState, ToolRun } from "./contract.ts";
import { competitorTracker } from "./competitor-tracker/index.ts";
import { contentSocialPlanner } from "./content-social-planner/index.ts";

/**
 * The six. Names match the folders in Agents/, so there is one name to search
 * for, which is CLAUDE.md 1.3.
 *
 * Every one is built: false. Nothing here runs yet, and the workspace says so
 * rather than showing an empty screen that looks broken. To turn one on: write
 * run(), set built to true. Nothing else changes.
 */
export const TOOLS: Tool[] = [
  {
    slug: "competitor-tracker",
    name: "Competitor Tracker",
    does: "Who you are up against, what they charge, and what to do about it.",
    built: true,
  },
  {
    slug: "content-social-planner",
    name: "Content & Social Planner",
    does: "A month of finished posts, in the words already on your own site.",
    built: true,
  },
  {
    slug: "proposal-quote-builder",
    name: "Proposal & Quote Builder",
    does: "A quote that looks like it came from a bigger firm.",
    built: false,
  },
  {
    slug: "lead-capture-funnel",
    name: "Lead Capture & Funnel Builder",
    does: "Turn the people who visit your site into enquiries.",
    built: false,
  },
  {
    slug: "pricing-package-builder",
    // Hidden from the header while the first two are still being proven.
    hidden: true,
    name: "Pricing & Package Builder",
    does: "What to charge, and how to package it so people choose.",
    built: false,
  },
  {
    slug: "process-sop-builder",
    // Hidden from the header while the first two are still being proven.
    hidden: true,
    name: "Process & SOP Builder",
    does: "Write down how you do things, so someone else can do them.",
    built: false,
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);

/**
 * The tools that can actually run, by slug. One line each, and this is the only
 * file outside a tool's own folder that a new tool touches.
 *
 * The engine used to import the Competitor Tracker by name, so every new tool
 * meant editing the engine and two people building two tools collided on the
 * first commit. The engine now looks the tool up here using the slug already
 * stored on the run, and calls whatever it finds.
 */
export const RUNNABLE: Record<string, ToolRun<AnyState>> = {
  [competitorTracker.slug]: competitorTracker as unknown as ToolRun<AnyState>,
  [contentSocialPlanner.slug]: contentSocialPlanner as unknown as ToolRun<AnyState>,
};

export const runnerFor = (slug: string): ToolRun<AnyState> | null =>
  RUNNABLE[slug] ?? null;
