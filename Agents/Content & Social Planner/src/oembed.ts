/**
 * Reading back the caption they actually published.
 *
 * This is the half of tracking that needs no Meta app, no OAuth and no review.
 * Proved on 15 September rather than taken from a write-up: calling the endpoint
 * with no access token and no `url` returns "(#100) The parameter url is
 * required", not "an access token is required". So the endpoint takes
 * unauthenticated calls, and `tracking.md`'s claim holds.
 *
 * It returns the embed and the caption. It returns no engagement of any kind,
 * which is why metrics are a separate feature with a separate blocker.
 */

export const OEMBED = 'https://graph.facebook.com/v21.0/instagram_oembed';

export type OembedFailure =
  | 'not-a-post'        // we rejected it before asking
  | 'not-found'         // code 24: deleted, private, or never existed
  | 'bad-request'       // code 100: we built the call wrong
  | 'rate-limited'      // codes 4, 17, 32
  | 'unavailable';      // network, timeout, anything else

export type OembedResult =
  | { ok: true; caption: string; author: string }
  | { ok: false; because: OembedFailure; detail: string };

/**
 * Meta's error codes, mapped once so the caller never reads a raw message.
 * Their `error_user_msg` is written for a developer, not for a barber.
 */
export function classifyError(code: number): OembedFailure {
  if (code === 24) return 'not-found';
  if (code === 100) return 'bad-request';
  if ([4, 17, 32, 613].includes(code)) return 'rate-limited';
  return 'unavailable';
}

/** What the owner is told. Never the platform's own wording. */
export const SAYS: Record<OembedFailure, string> = {
  'not-a-post': 'That looks like a profile rather than a post. Open the post itself and copy the link from there.',
  'not-found': 'We could not find that post. If it is on a private account we cannot read it, and if you have just posted it, give it a minute.',
  'bad-request': 'Something went wrong at our end reading that link. It is logged and nothing is lost.',
  'rate-limited': 'We are reading too many at once. It will go through shortly, and there is nothing for you to do.',
  'unavailable': 'Instagram did not answer. We will try again, and your post is recorded either way.',
};

export interface Fetcher { (url: string): Promise<{ status: number; json(): Promise<unknown> }> }

/**
 * `fetcher` is injected so the tests never touch the network. A test that
 * depends on Instagram being up is a test that fails on a Tuesday for reasons
 * nobody can fix.
 */
export async function fetchPublishedCaption(
  postUrl: string,
  fetcher: Fetcher = (u) => fetch(u, { signal: AbortSignal.timeout(10_000) }),
): Promise<OembedResult> {
  const query = `${OEMBED}?url=${encodeURIComponent(postUrl)}&omitscript=true`;
  let body: Record<string, unknown>;
  try {
    const res = await fetcher(query);
    body = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    return { ok: false, because: 'unavailable', detail: String(e) };
  }

  const error = body.error as { code?: number; message?: string } | undefined;
  if (error) {
    const because = classifyError(Number(error.code));
    return { ok: false, because, detail: `${error.code}: ${error.message ?? ''}`.trim() };
  }

  // The caption lives inside the embed markup, in a <p> under the permalink.
  const html = typeof body.html === 'string' ? body.html : '';
  return {
    ok: true,
    caption: captionFrom(html),
    author: typeof body.author_name === 'string' ? body.author_name : '',
  };
}

/**
 * The caption out of the embed blockquote.
 *
 * Meta does not return the caption as a field, only inside the embed HTML, and
 * the markup shape is theirs to change. So this returns an empty string rather
 * than throwing when the shape moves: a plan that cannot read one caption is a
 * plan that has learned nothing, and a plan that crashes is a lost month.
 */
export function captionFrom(html: string): string {
  const block = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1] ?? html;
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => m[1]);
  const text = paragraphs.map(stripTags).map(decode).map(s => s.trim()).filter(Boolean);
  // The last paragraph is Instagram's own "A post shared by ..." line.
  const ours = text.filter(t => !/^A post shared by /i.test(t));
  return ours.join('\n').trim();
}

const stripTags = (s: string) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
const decode = (s: string) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
