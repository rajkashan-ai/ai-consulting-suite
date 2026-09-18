# Handoff: AI Business Suite — "Instrument" visual direction

## Overview

A visual and interaction redesign of an AI suite for small businesses (1–20 people). The suite runs agents that do work overnight — writing social posts, tracking competitor prices, drafting review replies — and the product's job is to show the owner the few things that need a human, with the evidence behind every claim.

The current UI reads as a well-typeset document. This direction makes it read as an instrument: navy grounds, one action colour, monospace for every figure, and no decorative chrome.

Reference product in this handoff is a hair salon ("A Cut Above", St Albans). The copy in the design files is real product copy — keep the tone, replace the tenant data.

## About the design files

The files in this bundle are **design references created in HTML**. They are prototypes showing intended look and behaviour, not production code to copy.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Svelte, native — whatever the app already uses) following its established patterns, component library and state conventions. If no environment exists yet, pick the most appropriate framework and implement there. Do not ship the HTML.

The HTML also uses a streaming component runtime (`x-dc`, `sc-for`) that is specific to the design tool. Ignore it — read the markup and inline styles, and take the data shapes from the `Component` class at the bottom of each file.

## Fidelity

**High fidelity.** Colours, type, spacing, radii, row heights, motion timings and copy are final and specified below. Recreate them exactly using the codebase's own primitives. The only intentionally unresolved areas are icons (placeholder mono letters — substitute the codebase's icon set) and photography (placeholder slots).

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `navy` | `#1C2B40` | Brand colour. Shared with highintentlabs.com. Site chrome, marketing headers |
| `ground` | `#121A26` | App background |
| `surface` | `#1A2536` | Cards, inputs, table rows, active nav item |
| `surface-dim` | `#141D2A` | Inert or not-yet-available surfaces |
| `shell` | `#0E1520` | Sidebar, footer bars, right rails |
| `line` | `#263449` | Borders and dividers |
| `line-quiet` | `#1E2A3A` | Row separators inside a list |
| `line-hover` | `#3A4C68` | Border on hover |
| `paper` | `#FAFAF8` | Primary text on dark. Also the ground colour in light mode |
| `ink-2` | `#D3DBE6` | Figures, secondary headings |
| `body` | `#A7B3C2` | Body copy |
| `muted` | `#8C9AAD` | Labels, timestamps, metadata. **Floor — do not go dimmer for text** |
| `berry` | `#A61E4D` | Every action. Buttons, active nav chip, selected filter. Nothing else |
| `berry-hover` | `#C42D5F` | Berry hover |
| `berry-lift` | `#F2547D` | Berry on dark grounds: needs-you states, undo links, "ours" stamps |
| `berry-wash` | `#2B0E19` | Background of berry-tinted tags (with `#4A1A2C` border) |
| `charge` | `#D7FF4F` | **Agent is alive. Nothing else.** Pulse dots, "live" tool state |
| `source` | `#1F7A4D` | Evidence stamps only (`src`) |

Light mode (the website's default, and the suite's optional light theme) inverts: `#FAFAF8` ground, `#F1F1EC` shell, `#E4E4DE` line, `#1C2B40` ink, `#77838F` muted, berry unchanged. Charge lime has no light-mode equivalent — use berry-lift for agent-alive states on light grounds.

**Colour rules that matter more than the palette:**
1. Berry means "this acts". If it is not clickable it is not berry.
2. Charge lime means "an agent is running right now". It never marks data.
3. Deltas and comparisons are **neutral** (`#D3DBE6`). A competitor priced above you is not good news and below is not bad news — the sign carries the meaning, colour does not.
4. No gradients. No glows. One flat fill per surface.

### Typography

| Role | Family | Weight | Sizes |
|---|---|---|---|
| Display | Space Grotesk | 600 | 20 / 27 / 30 / 32 / 56 px, `letter-spacing: -0.02em` |
| UI | Manrope | 400 / 600 / 700 | 12.5 / 13.5 / 14.5 / 15 / 15.5 px |
| Figures + metadata | JetBrains Mono | 400 / 500 | 9.5 / 10 / 10.5 / 11 / 11.5 / 13 / 13.5 / 14 / 22 px |

- **Every** price, date, delta, count, timestamp, id and keyboard hint is JetBrains Mono. Prose never is.
- Uppercase labels: JetBrains Mono, 10–11px, `letter-spacing: 0.12–0.18em`.
- Body line-height 1.45–1.6. Prose measure capped at 58–62ch. `text-wrap: pretty` on paragraphs and multi-line headings.

### Space, radii, motion

- 4px step. Common gaps: 10 / 14 / 22 / 26 / 28 / 56.
- Shell padding 28px desktop, 18px mobile.
- Radii: 18 shell · 14 card · 12 mobile control · 9 nav item · 8 button · 7 small button · 4 chip.
- Table rows 46px desktop, 66px mobile. Sidebar 216px expanded, 72px collapsed.
- Motion: **160ms ease-out**, and nothing longer. Hover brightens the *border* (`line` → `line-hover`), never the fill. Agent pulse: opacity 0.35 → 1 → 0.35 over 2.4s (1.6s when a task is actively running).
- Focus: 2px `berry-lift` ring, 2px offset, never removed.
- Contrast measured: paper on ground 14.8:1, `muted` on surface 5.1:1, paper on berry 5.9:1.

## Screens

Files: `Instrument Screens.dc.html` (the chosen direction, five screens) and `Suite Design Directions.dc.html` (the three directions that were considered — context only, do not build).

### 1. Suite home — `#2a`

**Purpose:** answer "what needs me today", in under thirty seconds, and prove the agents were working.

**Layout:** 1240px shell, `grid-template-columns: 216px 1fr`.
- **Sidebar** (`shell` bg, `line` right border, 20px/14px padding): business identity block (28px berry rounded square with initial, name in Space Grotesk 14.5/600, location in mono 10px `muted`); nav list, 2px gaps; bottom card (`surface`, `line` border, 12px radius) showing time saved this month — mono 22px `paper`, label mono 10px uppercase.
- **Top bar** (16px/28px, `line` bottom): date in mono 11px uppercase; agent status ("3 agents running") in mono 11px `charge` with a 6px pulsing dot; search field (`surface`, `line` border, 230px, placeholder "Find a service, salon or post", `⌘K` hint right-aligned in mono 10.5px); primary button "New post".
- **Body** (28px padding, 26px gaps): section heading "Three things worth your attention" (Space Grotesk 27/600) + one line of `muted` subcopy; a 3-column grid of AttentionCards; then a 1.25fr/1fr split of ToolTiles and the overnight log.

**AttentionCard** — `surface` bg, `line` border, 14px radius, 18px padding, 12px gaps. Tag chip (mono 10px uppercase, tinted bg) + timestamp right-aligned; headline Space Grotesk 18/600, line-height 1.25; one sentence at 13.5px `body`; footer with a berry 12.5px/700 button and a plain-text secondary action in mono 11px `muted`. Hover: border → `line-hover`. Never more than three on screen.

**ToolTile** — `surface`/`line`, 12px radius, 14px padding. 22px chip with mono initial, name 14.5/700, state right-aligned in mono 9.5px uppercase `charge` when live. One line of *current status* underneath ("3 posts today, 1 waiting on a photo") — never a description of the tool. Only live tools get tiles; unbuilt tools are a single mono 11.5px `muted` line below the grid ("Profile Builder and Reviews are being built. Nothing you need to do.").

**Overnight log** — rows of `grid-template-columns: 54px 1fr`, mono 11px time + 13px text, `line-quiet` separators. Must include the honest entry when nothing happened ("Nothing needed doing. Went quiet.").

### 2. Content & Social Planner — `#2b`

**Purpose:** get a post out of a business that has no time and no ideas.

**Layout:** sidebar 216px, then `1fr / 352px` — list on the left, the photo brief and evidence on the right.

- **Sidebar bottom** carries a **MonthRail**: 30 squares, 21px, 4px radius, 3px gaps. Today = berry with `paper` digit; days with posts = `line-quiet` with `ink-2`; empty = transparent with `muted`. It is a prompter, not a calendar — it is not clickable into a day view.
- **Header:** "3 posts you made" + mono status; right side states the rule out loud: "the month is only the prompter".
- **StarterChips:** three equal cards, 11px radius, 12/14px padding. The first ("No ideas" / "we pick from what happened") is berry-tinted because it asks nothing of the user; the others are `surface`. Hover border → berry.
- **Draft cards:** tag chip + date + state (right, mono 10.5px — `berry-lift` when it needs the user); body copy at 15px/1.55, `#E6EBF2`, max 58ch; action row with berry button, plain "edit" / "rewrite", and schedule metadata right-aligned in mono 10.5px. The draft needing input gets `line-hover` border; settled drafts get `surface-dim` bg.
- **Right rail** (`shell` bg): photo slot — 168px, 12px radius, 1px dashed `line`, striped background `repeating-linear-gradient(135deg, #16202D 0 8px, #1A2536 8px 16px)`, centred mono 11px caption. Then the one-line photo brief at 13.5px. Then EvidenceStamps. Then, pinned to the bottom, "Schedule all three" (berry) and a quiet outlined secondary.

**EvidenceStamp** — 2px left rule, `ground` bg, 9/11px padding. `src` in `source` green, `ours` in `berry`; label mono 9.5px uppercase, value mono 11px `muted`. **Always visible. Never inside a disclosure or tooltip.** This is the product's differentiator; hiding it removes it.

### 3. Competitor Tracker, 390px — `#2c`

**Purpose:** the tracker on a phone, and the evidence detail it pushes to.

Two screens. List screen: status bar; header with tool label + tier name (Space Grotesk 20/600) and a 44px chevron control; a segmented tier control as chips (mono 11.5px, 9/12px padding, berry when selected) — **the three desktop price columns become one tier at a time, never a horizontal scroll**; a median/you summary card (`surface`, both figures mono 22px, both `paper`); then rows.

**Row (mobile):** min-height 44px, real height ~66px, 14/18px padding. Line one: salon name 15/700 + tag chip, price right in mono 15px. Line two: the position ruler (5px track, `line-quiet` bg, `#33465F` fill to the salon's percentile, 2px `paper` tick at the same point marking where *you* sit) and the delta right-aligned in mono 11.5px, neutral.

Sticky bottom: full-width berry button 52px, mono 10.5px provenance line under it. Tab bar: 4 items, 56px tall, 22px chips, 10.5px labels.

Detail screen: big figure (Space Grotesk 34/600), one `berry-lift` line of comparison, EvidenceStamps as a list, an AgentPulse card, and a berry action pinned to the bottom.

### 4. Day one — `#2e`

**Purpose:** the first visit, when there is no data, no history and nothing worth attention.

Same shell. Nav items that do not work yet read `off` in mono 9.5px. The time-saved card becomes a dashed `surface-dim` box with one sentence. Body: heading "Three things from you, then it runs on its own", one paragraph, then three numbered setup cards (step 1 live in berry, steps 2–3 `surface-dim` with `#1E293B` chips), each with title, one sentence, and its own button. Below: a two-column split — "What happens after that" (tonight / tomorrow / this week) and a dashed empty-state card headed "Nothing needs you yet".

Rule: **do not show an empty dashboard.** The home screen only appears once the first agent has run.

### 5. What changed — `#2f`

**Purpose:** the tracker's default view. Answers the question people actually open it for.

Header: "3 changes since 12 September" (Space Grotesk 20/600) + scope in mono; two filter chips, "Changed only" (berry, default) and "Full table" (quiet — the six-column table from the earlier direction lives behind it).

Columns: `1.3fr / 110 / 110 / 120 / 96 / 1.1fr` — Salon, Was, Now, Move, Read, Worth knowing. Changed rows: 3px berry left rule, `surface` bg, `paper` name, `Was` struck through in `muted`, `Now` at mono 14px `paper`, `Move` neutral `ink-2`, and one plain-English sentence in the last column ("third cut in six weeks"). Unchanged rows: transparent, no rule, everything `muted`.

Footer bar (`shell`): AgentPulse on the left ("writing a response post about The Chair…"); on the right "marked as read · **undo**" (undo in `berry-lift`) and the berry "Re-check prices".

## Interactions & behaviour

- **AgentPulse replaces every spinner and skeleton.** A `charge` dot plus one plain sentence naming what the agent is doing. No progress bars, no percentages, no shimmer.
- **Every destructive or dismissive action is undoable** for the rest of the session — ignore, mark as read, send. Undo is a text link in `berry-lift`, placed next to the thing it undoes, not in a corner toast.
- **Hover:** border `line` → `line-hover`, 160ms. Fills do not change. Rows get `#16202D`.
- **Nav:** active item = `surface` bg, `paper` label, berry chip. Inactive = transparent, `muted`. Unavailable = `muted` label, `#1E293B` chip, `off`/`soon` in mono, not clickable, still visible.
- **Sort and filter** live as chips in the header row, never as dropdown menus.
- **⌘K** opens search, which is scoped search ("Find a service, salon or post") — not a chat box. This product's premise is that you stop chatting with AI, so the primary input is never an open prompt.
- **Responsive:** ≥1200px three-column; 900–1200px collapse the right rail to a section below the list; <900px sidebar becomes the 4-item bottom tab bar, tables become the mobile row pattern, one tier at a time.
- **Touch targets** never below 44px. Mobile rows 66px, tabs 56px, primary buttons 52px.

## State

Per screen:
- **Home:** `attentionItems[]` (each with `dismissed` + an undo buffer), `tools[]` with `live | soon` and a live status string, `activity[]`, `agentsRunning` count.
- **Planner:** `drafts[]` with `state: needs-input | ready | draft`, `starter` selection, `month[]` with `posted | today | empty`, `photoBrief`, `evidence[]`.
- **Tracker:** `tier` (graduate | stylist | director), `rows[]` with current + previous price and `lastRead` timestamp, `view: changed | full`, `selectedSalon`, `agentTask` (null or a sentence).
- **First run:** `setupStep` 1–3, gates the whole app; home is unreachable until step 1 completes.

Every figure the product shows needs provenance attached to it — a source URL or a user upload with a read date, or the explicit "ours" marker when the product inferred it. Model this on the data, not in the view: if a claim has no evidence, the UI must be able to say so rather than going quiet.

## Assets

- Fonts: Space Grotesk, Manrope, JetBrains Mono (Google Fonts). Self-host in production.
- Icons: **not designed.** The mono letter chips are placeholders — substitute the codebase's icon set at 22px in a 6px-radius chip.
- Photography: placeholder striped slots. Real photos come from the tenant.
- Logo: use the High Intent Labs navy mark from the existing site.

## Files

- `Instrument Screens.dc.html` — the direction to build. Screens `#2a` home, `#2b` planner, `#2c` mobile, `#2d` token/component spec, `#2e` day one, `#2f` what changed.
- `Suite Design Directions.dc.html` — the three directions considered (`#1a` Instrument, `#1b` Atelier, `#1c` Signal), each on the tracker in dark and light. Context for why the chosen direction looks the way it does. Not for implementation.

Open either file in a browser. Both are pannable canvases — the screens sit side by side.

## Relationship to highintentlabs.com

Shared tokens, different personalities. The website sells: off-white ground, navy ink, berry as its single accent, roomy and editorial. The product works: the same three tokens inverted onto navy, plus two the site never uses — `charge` lime for a live agent and the evidence stamp. Same fonts, same 4px step, same radii, same 160ms curve. Do not let the product drift into marketing gradients, and do not let the site adopt the dark ground.
