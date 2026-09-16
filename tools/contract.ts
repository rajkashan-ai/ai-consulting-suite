import type { Business, ToolContext } from "./types.ts";

/**
 * What a tool has to provide, and the only thing the engine knows about it.
 *
 * The engine used to import the Competitor Tracker by name: its stages, its
 * playbook, its document. Every new tool therefore meant editing the engine,
 * so two people building two tools edited the same file and collided on the
 * first commit. Six tools and one engine is six sessions and one file.
 *
 * Now the engine looks the tool up by the slug already stored on the run and
 * calls whatever it finds. A session building the Content Planner touches its
 * own folder and one line of the registry. Nothing else.
 *
 * The hooks are optional on purpose. The tracker keeps a per-trade playbook
 * and needs to load it before the first step and fold into it after each one;
 * a tool with no shared knowledge implements neither and the engine does not
 * care which.
 */

export type Step<S> = {
  stage: string;
  state: S;
  /** In the customer's units. "3 of 5 competitors read", never "step 4". */
  progress: string;
};

/**
 * Anything a tool wants to keep between steps. The engine stores and returns it
 * and never looks inside, which is what lets a tool change its own shape
 * without anything outside the tool's folder knowing.
 */
export type AnyState = Record<string, unknown>;

export type ToolRun<S extends AnyState = AnyState> = {
  /** Matches the slug on the run row and the folder name. */
  slug: string;

  /** Advance one step and stop. Must never throw: fail the run instead. */
  advance(stage: string, state: S, business: Business, ctx: ToolContext): Promise<Step<S>>;

  /** The document to store when a run is done, or null if there is nothing. */
  buildBody(state: S): unknown | null;

  /**
   * Why this document is not worth storing, or null when it is.
   *
   * A run that reaches here has already been paid for, so refusing costs
   * nothing that is not already spent, and it is the last place to catch
   * something that passed every check on the way and still has nothing in it.
   */
  hollow(body: unknown): string | null;

  /** What the stored document is called. */
  title(now: Date): string;

  /**
   * Load whatever this tool knows before its first step. Called on every step,
   * so it must decide for itself whether there is anything to do.
   */
  prepare?(state: S, business: Business, db: Db): Promise<S>;

  /**
   * Fold what this run learned back into whatever the tool shares between
   * runs. Called on the way past, not only on success: a run that found the
   * right listing and then failed still learned where the listing was.
   */
  learn?(state: S, business: Business, db: Db): Promise<void>;
};

/**
 * The database, as much of it as a tool is allowed to see.
 *
 * Deliberately the whole admin client rather than a narrowed shim: narrowing it
 * would mean the engine knowing which tables each tool needs, which is the
 * coupling this file exists to remove.
 */
export type Db = {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): { maybeSingle(): Promise<{ data: unknown }> };
    };
    upsert(row: Record<string, unknown>): Promise<unknown>;
  };
};
