/**
 * Compare the designed screen with what the pipeline actually produced.
 *
 * The designed screen is the target. The pipeline's output is the candidate.
 * Most of what differs between them is not a defect: the dates move because the
 * month starts on the day you run it, and the counts move because they count
 * real things. What is a defect is a missing section, a post that is not a
 * finished post, or a stat that reports our machinery instead of their month.
 *
 * So this returns two lists, and the caller treats them differently:
 *   breaks   - the candidate is not a whole screen. These fail the suite.
 *   gaps     - the candidate is a whole screen that reads worse than the design.
 *              These are reported, and the recorded set is asserted, so a new
 *              one fails and a fixed one has to be taken off the list.
 */
export function compareScreen(target, got) {
  const breaks = [], gaps = [];

  if (JSON.stringify(got.sections) !== JSON.stringify(target.sections)) {
    breaks.push(`sections differ: ${JSON.stringify(got.sections)}`);
  }
  if (got.stats.length !== target.stats.length) breaks.push(`${got.stats.length} stats, target has ${target.stats.length}`);
  if (got.posts.length !== target.posts.length) breaks.push(`${got.posts.length} posts, target has ${target.posts.length}`);
  if (got.weeks.length !== target.weeks.length) breaks.push(`${got.weeks.length} weeks, target has ${target.weeks.length}`);

  for (const p of got.posts) {
    const n = p.words.split(/\s+/).filter(Boolean).length;
    if (n < 40) breaks.push(`${p.day} is ${n} words, too short to paste`);
    if (!p.shot || p.shot.length < 20) breaks.push(`${p.day} has no shot instruction`);
  }
  for (const b of got.blanks) {
    if (b.split(/\s+/).length < 3) breaks.push(`blank "${b}" tells them nothing`);
  }

  /* A figure is allowed to move. The words beside it are the design. */
  target.stats.forEach((t, i) => {
    const g = got.stats[i];
    if (!g) return;
    /* The number is data and moves. The unit is the design, except for its
       plural, which follows the number: "1 blank" is not a change of meaning. */
    const strip = (x) => x.replace(/^[\d.]+( of [\d.]+)?\s*/, '').trim().replace(/s$/, '');
    if (strip(t.figure) !== strip(g.figure)) gaps.push(`stat ${i + 1} measures "${strip(g.figure)}", designed as "${strip(t.figure)}"`);
  });

  target.posts.forEach((t, i) => {
    const g = got.posts[i];
    if (!g) return;
    if (t.words.split('.')[0] !== g.words.split('.')[0]) {
      gaps.push(`post ${i + 1} opens "${g.words.split('.')[0]}", designed "${t.words.split('.')[0]}"`);
    }
  });

  if (got.blanks.length !== target.blanks.length) {
    gaps.push(`${got.blanks.length} blanks, designed ${target.blanks.length}`);
  }
  return { breaks, gaps };
}

const clean = (x) => x.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&pound;/g, '£')
  .replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const one = (s, re) => clean((s.match(re) || [])[1] || '');

/** Read a rendered screen back out of its own markup, in the target's shape. */
export function readScreen(html) {
  return {
    sections: [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => clean(m[1])),
    stats: [...html.matchAll(/<div class="stat[^"]*"><span class="stat__figure">([\s\S]*?)<\/span><span class="stat__label[^"]*">([\s\S]*?)<\/span>/g)]
      .map((m) => ({ figure: clean(m[1]), label: clean(m[2]) })),
    posts: [...html.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((m) => ({
      day: one(m[1], /t-card u-push">([\s\S]*?)<\/span>/),
      words: one(m[1], /<p class="t-doc">([\s\S]*?)<\/p>/),
      shot: one(m[1], /Photograph<\/p><p class="t-row">([\s\S]*?)<\/p>/),
    })),
    weeks: [...html.matchAll(/class="feed__row[^"]*"/g)].map((m) => m[0]),
    blanks: [...html.matchAll(/class="blank">\[([^\]]+)\]/g)].map((m) => m[1]),
  };
}
