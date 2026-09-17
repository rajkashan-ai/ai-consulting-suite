import type { Cadence, Channel, Recommendation } from "../../../Agents/Content & Social Planner/src/types.ts";
import type { Cited } from "./sources.ts";
import { isWrittenPost, type PlannedPost, type RunState, type WeekRow } from "./stages.ts";

/**
 * What gets stored, and whether it is worth storing.
 *
 * Kept out of the engine on purpose. The Tracker learned this the expensive
 * way: four lines inside the engine meant no test could reach them, so every
 * test checked the state on the way to the document and nothing checked the
 * document. The two are assembled from different places, and a run can have a
 * good state and store a hollow document.
 *
 * A run that reaches here has already been paid for, so refusing costs nothing
 * that is not already spent. An honest failure beats a page that looks finished
 * and has no posts on it.
 */

export type DocumentBody = {
  business: string;
  /** The cadence we recommend, and every reason with its source. */
  recommendation: Recommendation;
  cadence: Cadence;
  channels: Channel[];
  /** How they already sound, read off their own copy. */
  voice: { words: string; source: Cited | null };
  /** Every slot in the month. The written ones carry words. */
  posts: PlannedPost[];
  weeks: WeekRow[];
  /** What we took off, and why. Shown: a gap with no reason reads as a shrug. */
  dropped: { what: string; why: string }[];
  /** Every page we read, so the reader can check any claim on the page. */
  pages: { url: string; fetchedOn: string }[];
};

export function buildBody(state: RunState): DocumentBody | null {
  if (!state.recommendation || !state.cadence) return null;
  return {
    business: "",
    recommendation: state.recommendation,
    cadence: state.cadence,
    channels: state.channels ?? [],
    voice: state.voice ?? { words: "", source: null },
    posts: state.posts ?? state.slots ?? [],
    weeks: state.weeks ?? [],
    dropped: state.dropped ?? [],
    pages: (state.pages ?? []).map((p) => ({ url: p.url, fetchedOn: p.fetchedOn })),
  };
}

/**
 * Why this document is not worth storing, or null if it is.
 *
 * Each of these is a real way this product can arrive looking complete and be
 * worthless, not a list of everything that could go wrong.
 */
export function hollow(body: DocumentBody | null): string | null {
  if (!body) return "there is no plan";

  if (!body.posts.length) return "the month has no posts in it";

  const written = body.posts.filter(isWrittenPost);
  if (!written.length) {
    // The shape with no words is the failure this tool is most likely to ship
    // looking finished: thirty days of dates and channels and nothing to post.
    return "the month was laid out but nothing was written";
  }

  /**
   * A post with no source is a claim with nothing behind it, and this tool
   * writes what the owner publishes under their own name. The checking stage
   * drops these, so one arriving here means the checking did not run.
   */
  const unsourced = written.filter((p) => !p.source?.url);
  if (unsourced.length) {
    return `${unsourced.length} of the posts have nothing on your site behind them`;
  }

  if (!body.recommendation?.because?.length) {
    return "we cannot say why we suggested this often";
  }

  /**
   * Every reason carries where it came from. A recommendation is a claim like
   * any other, and "post twice a week" with no arithmetic behind it is the
   * order-taking this tool exists not to do.
   */
  if (body.recommendation.because.some((r) => !r.from)) {
    return "one of the reasons has nothing behind it";
  }

  if (!body.channels.length) return "there is nowhere to post it";

  if (!body.pages.length) return "we did not manage to read your website";

  return null;
}
