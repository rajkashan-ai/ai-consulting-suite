/**
 * The shapes the model must answer in, and the areas the grid compares.
 *
 * Lifted out of stages.ts on 2026-09-17, with the prompts. See
 * ARCHITECTURE.md section 3.
 *
 * Shape is enforced here rather than asked for in prose, which is the rule
 * that stopped the drift: a length requested in a sentence is a length that
 * wanders, and a maxLength in a schema is not.
 */


export const BATTLECARD_SHAPE = {
  name: "battlecard",
  description: "What each business does, and the three things to do about it.",
  input_schema: {
    type: "object",
    properties: {
      competitors: {
        type: "array",
        description: "The businesses, with the customer's own first.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            claims: {
              type: "object",
              description: "Facts by area. Empty areas are fine and honest.",
              properties: {
                pricing: { type: "array", items: { $ref: "#/$defs/claim" } },
                channels: { type: "array", items: { $ref: "#/$defs/claim" } },
                reviews: { type: "array", items: { $ref: "#/$defs/claim" } },
                blindspots: { type: "array", items: { $ref: "#/$defs/claim" } },
              },
            },
          },
          required: ["name", "claims"],
        },
      },
      comparison: {
        type: "array",
        description:
          "One grid per area. A row is one comparable thing and a cell is what each " +
          "business publishes about it. This is what the customer reads to compare.",
        items: {
          type: "object",
          properties: {
            area: { type: "string", enum: ["pricing", "channels", "reviews", "blindspots"] },
            columns: {
              type: "array",
              description: "The customer's name first, then the competitors, exactly as named.",
              items: { type: "string" },
            },
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  attribute: {
                    type: "string",
                    description: "One comparable thing: 'Classic cut', 'Reviews', 'Opens'.",
                  },
                  cells: {
                    type: "array",
                    description: "One per column, same order. Null where nothing is published.",
                    items: {
                      type: "object",
                      properties: {
                        /**
                         * The comparable fact and nothing else.
                         *
                         * This used to be a free string and came back as full
                         * sentences: "Book buttons against each service on
                         * their booking profile". Six of those across a row
                         * cannot be compared, because reading them is the
                         * work. A price row must read across as £15, £18, £20.
                         *
                         * Capped in the schema rather than asked for politely,
                         * because a length asked for in prose is a length that
                         * drifts.
                         */
                        value: {
                          type: ["string", "null"],
                          maxLength: 40,
                          description:
                            "The comparable fact alone, as short as it can be. " +
                            "A price: '£15.00'. A count: '607 reviews'. A yes: " +
                            "'Own site'. Never a sentence, never a reason, never " +
                            "a word the other columns also say.",
                        },
                        note: {
                          type: ["string", "null"],
                          maxLength: 80,
                          description:
                            "Only when the value is misleading without it. " +
                            "'from', 'under 12s only', 'evenings too'. Usually null.",
                        },
                        from: {
                          type: ["integer", "null"],
                          description:
                            "The number of the page this came from. Null only when the cell is null.",
                        },
                      },
                      required: ["value", "note", "from"],
                    },
                  },
                },
                required: ["attribute", "cells"],
              },
            },
            note: { type: ["string", "null"] },
          },
          required: ["area", "columns", "rows"],
        },
      },
      where_you_win: {
        type: "array",
        description:
          "Up to four things this business does better than the others, each from a page we read. Empty is an honest answer.",
        items: {
          type: "object",
          properties: {
            /**
             * The finding itself, with the number in it.
             *
             * These were coming back as a label, "You put five prices in plain
             * sight on your own site", followed by four lines of working. An
             * owner reads the heading and stops, so the heading has to be the
             * answer.
             */
            point: {
              type: "string",
              maxLength: 90,
              description:
                "The finding, with its number in it. 'You publish 5 prices, they publish 2.'",
            },
            detail: {
              type: "string",
              maxLength: 160,
              description:
                "One sentence of evidence. Never mention pages or page numbers: " +
                "the reader cannot see them and they mean nothing to them.",
            },
            from: { type: "integer", description: "The number of the page this came from." },
          },
          required: ["point", "detail", "from"],
        },
      },
      where_they_win: {
        type: "array",
        description: "Up to four things the others do better, each from a page we read.",
        items: {
          type: "object",
          properties: {
            point: {
              type: "string",
              maxLength: 90,
              description: "The finding, with its number in it.",
            },
            detail: {
              type: "string",
              maxLength: 160,
              description:
                "One sentence of evidence. Never mention pages or page numbers.",
            },
            from: { type: "integer", description: "The number of the page this came from." },
          },
          required: ["point", "detail", "from"],
        },
      },
      actions: {
        type: "array",
        description: "Exactly three. Order does not matter: we rank them ourselves, by the size of the gap each one closes.",
        items: {
          type: "object",
          properties: {
            area: { type: "string", enum: ["pricing", "channels", "reviews", "blindspots"] },
            headline: { type: "string", maxLength: 90 },
            why: { type: "string", maxLength: 200 },
            /**
             * The size of the hole, counted off the grid.
             *
             * Four of five doing something is a different proposition from one
             * of five, and the page said neither. It is also what the order is
             * built from, so the ranking stops being an opinion.
             */
            gap: {
              type: "object",
              description:
                "Counted from the comparison above: how many of the businesses " +
                "compared already do this, out of how many were compared. " +
                "Never estimated.",
              properties: {
                theyDo: { type: "integer" },
                outOf: { type: "integer" },
              },
              required: ["theyDo", "outOf"],
            },
            effect: {
              type: "string",
              maxLength: 140,
              description:
                "One line on how doing this brings in more enquiries, in the " +
                "owner's terms. 'Someone comparing two barbers on price can " +
                "only pick the one who shows it.' Never a promise of a number.",
            },
            evidence: { type: "array", items: { $ref: "#/$defs/claim" } },
            deferred: { type: ["string", "null"] },
          },
          required: ["area", "headline", "why", "gap", "effect", "evidence"],
        },
      },
    },
    required: ["competitors", "comparison", "where_you_win", "where_they_win", "actions"],
    $defs: {
      claim: {
        type: "object",
        properties: {
          text: { type: "string" },
          value: { type: ["string", "number", "null"] },
          from: {
            type: ["integer", "null"],
            description: "The number of the page this came from.",
          },
        },
        required: ["text", "value", "from"],
      },
    },
  },
};

/**
 * What the repair is allowed to return: the words, and nothing else.
 *
 * It used to be handed the whole battlecard shape. Once the comparison grid was
 * added to that shape, a rewrite had to regenerate the grid as well, ran out of
 * output tokens partway, and came back with no actions at all. The card then
 * failed on "wrong-count" — a fault introduced by the thing sent to fix a
 * different fault.
 *
 * The grid is structured data and cannot trip a guard that reads prose, so
 * there was never a reason to rewrite it.
 */

/**
 * What the repair is allowed to return: the words, and nothing else.
 *
 * It used to be handed the whole battlecard shape. Once the comparison grid was
 * added to that shape, a rewrite had to regenerate the grid as well, ran out of
 * output tokens partway, and came back with no actions at all. The card then
 * failed on "wrong-count" — a fault introduced by the thing sent to fix a
 * different fault.
 *
 * The grid is structured data and cannot trip a guard that reads prose, so
 * there was never a reason to rewrite it.
 */
export const REPAIR_SHAPE = {
  name: "reworded",
  description: "The same battlecard with the refused wording changed and nothing else.",
  input_schema: {
    type: "object",
    properties: {
      competitors: BATTLECARD_SHAPE.input_schema.properties.competitors,
      actions: BATTLECARD_SHAPE.input_schema.properties.actions,
      where_you_win: BATTLECARD_SHAPE.input_schema.properties.where_you_win,
      where_they_win: BATTLECARD_SHAPE.input_schema.properties.where_they_win,
    },
    required: ["competitors", "actions", "where_you_win", "where_they_win"],
    $defs: BATTLECARD_SHAPE.input_schema.$defs,
  },
};

/** The grid alone: the big, structured half. */

/** The grid alone: the big, structured half. */
export const GRID_SHAPE = {
  name: "comparison",
  description: "One grid per area, a row per comparable thing and a column per business.",
  input_schema: {
    type: "object",
    properties: { comparison: BATTLECARD_SHAPE.input_schema.properties.comparison },
    required: ["comparison"],
  },
};

/** The four areas, in the order they are read on the page. */
/**
 * The comparison areas, one model call each.
 *
 * Every call carries the whole evidence pile, so this array is a multiplier on
 * the largest input cost in the product: four areas meant the evidence was
 * bought four times. Cut to the two the tool is actually for, the basics, on
 * 2026-09-16. Channels and blindspots were the extras, and extras are not worth
 * doubling the bill for while we are still working out the shape.
 */

/** The four areas, in the order they are read on the page. */
/**
 * The comparison areas, one model call each.
 *
 * Every call carries the whole evidence pile, so this array is a multiplier on
 * the largest input cost in the product: four areas meant the evidence was
 * bought four times. Cut to the two the tool is actually for, the basics, on
 * 2026-09-16. Channels and blindspots were the extras, and extras are not worth
 * doubling the bill for while we are still working out the shape.
 */
export const ALL_AREAS = ["pricing", "channels", "reviews", "blindspots"] as const;

export type GridArea = (typeof ALL_AREAS)[number];

/** The ones a run actually asks for. Turning one back on is adding it here. */

/** The ones a run actually asks for. Turning one back on is adding it here. */
export const GRID_AREAS: readonly GridArea[] = ["pricing", "reviews"];

/**
 * What each area is for, said once.
 *
 * A call asked for one area needs to know what that area means, because the
 * word on its own is not an instruction. These were implicit when all four were
 * written together and the model could see the others for contrast.
 */

/**
 * What each area is for, said once.
 *
 * A call asked for one area needs to know what that area means, because the
 * word on its own is not an instruction. These were implicit when all four were
 * written together and the model could see the others for contrast.
 */
export const AREA_MEANS: Record<GridArea, string> = {
  pricing:
    "What each one charges for the same named service. Rows are services, not " +
    "businesses. Only services more than one of them publishes.",
  channels:
    "Where each one can be found and booked: their own site, a booking platform, " +
    "social. What they publish about opening, booking and getting there.",
  reviews:
    "Ratings and how many, and the themes that repeat. Counts and themes only, " +
    "never the name of anyone who wrote one.",
  blindspots:
    "What a business does not publish that the others do. An absence you can " +
    "point at on a page, never an absence you assume.",
};

/** The grid shape, restricted to one area, so a call cannot answer for another. */

/** The grid shape, restricted to one area, so a call cannot answer for another. */
/**
 * The same shape for every area, on purpose.
 *
 * This built a different schema per area: the description named the area and
 * the `area` enum held only that one. Tools sit at the front of what can be
 * cached, before the system prompt and the messages, so a tools block that
 * differs between two calls means nothing after it can match either.
 *
 * Measured on 2026-09-17: the two grid calls each sent an identical 71,135
 * character evidence prefix and each WROTE 38,390 cache tokens and read none.
 * The second paid full price for a block the first had just stored.
 *
 * Which area a call is for is said in the prompt, and the caller stamps the
 * area on every row it keeps from that call, so pinning it in the schema as
 * well was belt and braces that cost a cache hit.
 *
 * The parameter stays because callers read better naming the area they want,
 * and because a future shape may differ by area for a reason worth paying for.
 */
export function gridShapeFor(_area: GridArea) {
  const items = structuredClone(
    BATTLECARD_SHAPE.input_schema.properties.comparison,
  ) as { items: { properties: { area: { enum: string[] } } } };
  items.items.properties.area = { enum: [...GRID_AREAS] } as never;

  return {
    name: "comparison",
    description: "One area of the comparison: a row per comparable thing, a column per business.",
    input_schema: {
      type: "object",
      properties: { comparison: items },
      required: ["comparison"],
    },
  };
}

/** The words: what each business is, where you stand, and what to do. */

/** The words: what each business is, where you stand, and what to do. */
export const NARRATIVE_SHAPE = {
  name: "battlecard",
  description: "The claims per business, the two columns, and the three actions.",
  input_schema: {
    type: "object",
    properties: {
      /**
       * The one thing worth knowing, first.
       *
       * The first line an owner read was a finding that began "You publish 5
       * prices", and nothing on the page had yet said what 5 was or who they
       * were. Raj: "there is no short summary."
       *
       * It sits above a fixed line naming the count and the town, so the
       * orientation is never generated and cannot be wrong. This is the part
       * that is written, and it is dropped rather than shown if it breaks any
       * of the same rules the rest of the page obeys.
       */
      headline: {
        type: "object",
        description:
          "The single most useful thing on this page, in one sentence, with " +
          "its numbers in it. 'You are the cheapest of 6 for a standard cut, " +
          "and the only one with no public reviews.' Never a greeting, never a " +
          "summary of what the page contains.",
        properties: {
          said: { type: "string", maxLength: 120 },
          from: { type: "integer", description: "The number of the page this came from." },
        },
        required: ["said", "from"],
      },
      competitors: BATTLECARD_SHAPE.input_schema.properties.competitors,
      where_you_win: BATTLECARD_SHAPE.input_schema.properties.where_you_win,
      where_they_win: BATTLECARD_SHAPE.input_schema.properties.where_they_win,
      actions: BATTLECARD_SHAPE.input_schema.properties.actions,
    },
    required: ["headline", "competitors", "where_you_win", "where_they_win", "actions"],
    $defs: BATTLECARD_SHAPE.input_schema.$defs,
  },
};

/**
 * A row nobody can be compared on is not a comparison.
 *
 * WHY THIS EXISTS
 * `AREA_MEANS.pricing` has always said "Only services more than one of them
 * publishes." That sentence was sent to the model and checked by nothing. On
 * 2026-09-17 the model returned a pricing grid with one row, "Ladies cut and
 * finish", where the only figure in it was the customer's own. The screen drew
 * a six-column table with five columns of "Not published", which reads as a
 * broken product rather than as an honest finding.
 *
 * The rule is not new and the row was never allowed. Nothing was enforcing it.
 *
 * WHAT COUNTS
 * Two cells with a value, anywhere in the row. Your own column counts as one of
 * them: you against one competitor is a comparison, you against nobody is a
 * price list. A row that fails is dropped rather than repaired, because there
 * is no honest way to invent the second figure.
 */
export function worthComparing(row: { cells?: { value?: unknown }[] } | null | undefined): boolean {
  const withValue = (row?.cells ?? []).filter(
    (c) => c?.value != null && String(c.value).trim() !== "",
  ).length;
  return withValue >= 2;
}

/**
 * The same grid with the lonely rows gone.
 *
 * An area that loses every row keeps its note and its columns. The screen
 * already has a state for "nothing on pricing yet", and that state plus the
 * reason is worth more to an owner than either a table of blanks or a run that
 * fails outright. For a salon whose competitors publish nothing, "nobody here
 * prints a price" IS the finding.
 */
export function onlyComparable<T extends { rows?: { cells?: { value?: unknown }[] }[] }>(
  grid: T,
): T {
  return { ...grid, rows: (grid.rows ?? []).filter(worthComparing) };
}
