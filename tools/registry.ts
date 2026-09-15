import type { Tool } from "./types.ts";

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
    built: false,
  },
  {
    slug: "content-social-planner",
    name: "Content & Social Planner",
    does: "A month of finished posts, in the words already on your own site.",
    built: false,
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
    name: "Pricing & Package Builder",
    does: "What to charge, and how to package it so people choose.",
    built: false,
  },
  {
    slug: "process-sop-builder",
    name: "Process & SOP Builder",
    does: "Write down how you do things, so someone else can do them.",
    built: false,
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
