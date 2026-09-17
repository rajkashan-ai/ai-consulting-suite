/**
 * What a second business found.
 *
 * Every one of these is a defect the barber could not show, because the barber
 * happened not to have the shape that breaks it. They are here so the next site
 * does not have to find them again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessName, channels, prices } from '../src/extract.js';
import { linkedPaths } from '../bin/plan.mjs';

const titled = (t: string) => `<html><head><title>${t}</title></head><body></body></html>`;

test('a title of descriptor, name and town gives back the name', () => {
  assert.equal(
    businessName(titled('Experienced Dog Groomer | PAW-Lished | Shrewsbury'), 'https://paw-lished.co.uk/'),
    'PAW-Lished');
});

test('a title with no separator is the name', () => {
  assert.equal(businessName(titled('The Barber Shop Shrewsbury'), 'https://shrewsburybarber.co.uk/'),
    'The Barber Shop Shrewsbury');
});

test('with no domain to go on, the first part is the name, never the town', () => {
  assert.equal(businessName(titled('Canny Cuts | Shrewsbury'), ''), 'Canny Cuts');
});

test('a price read out of a list does not keep the conjunction', () => {
  const p = prices('Small Breeds from £20, Medium Breeds from £30 and Giant Breeds from £60');
  assert.ok(p['giant breeds from'], `got ${JSON.stringify(Object.keys(p))}`);
  assert.equal(p['and giant breeds from'], undefined);
});

test('a facebook page with no readable handle is a channel with no handle', () => {
  const c = channels('<a href="https://facebook.com/profile.php?id=61551234567">us</a>');
  assert.deepEqual(c, [{ channel: 'facebook' }]);
});

test('a site that links its own pages on the apex while we asked for www is still one site', () => {
  const html = '<a href="https://paw-lished.co.uk/dog-grooming/">Dog grooming</a>' +
    '<a href="https://paw-lished.co.uk/contact/">Contact</a>';
  assert.deepEqual(linkedPaths(html, 'https://www.paw-lished.co.uk'), ['/dog-grooming/']);
});

test('a page named for prices is read before one merely linked as book now', () => {
  const html = '<a href="/book">Book now</a><a href="/prices">Prices</a>';
  assert.equal(linkedPaths(html, 'https://x.co')[0], '/prices');
});

test('the crawler does not wander into the policy pages', () => {
  const html = '<a href="/privacy">Our service promise</a><a href="/cookie-policy">Pricing</a>';
  assert.deepEqual(linkedPaths(html, 'https://x.co'), []);
});

/* --- what the second business showed on the screen itself --- */
import { renderScreen } from '../src/render.js';
import { voiceSample } from '../src/extract.js';

const onePost = {
  channels: ['facebook'], voice: 'We groom dogs in Shrewsbury and we are gentle with the nervous ones.',
  recommendation: { cadence: 'weekly', because: [{ text: 'You said you have about 2 hours a week for this.' }] },
  posts: [{ date: '2026-09-15', week: 1, channel: 'facebook', angle: 'prices', kind: 'useful',
    words: 'Our prices, so nobody has to ask first. '.repeat(8), shot: 'Your price list where you have it written down.',
    why: 'A price nobody has to ask for is a reason to walk in.' },
    { date: '2026-09-22', week: 2, channel: 'facebook', angle: 'how-it-works', kind: 'useful' }],
};
const oneFacts = { name: 'PAW-Lished', readAt: '2026-09-14', pages: ['https://paw-lished.co.uk/'],
  channels: [{ channel: 'facebook' }], known: { prices: {}, services: [] } };

test('one post a week does not read as "Tuesday are a suggestion"', () => {
  const html = renderScreen(onePost as any, oneFacts as any);
  assert.match(html, /Tuesday is a suggestion/);
  assert.doesNotMatch(html, /\bTuesday are a suggestion/);
});

test('the date the month runs to is not lowercased to "6 oct"', () => {
  const html = renderScreen(onePost as any, oneFacts as any);
  assert.match(html, /posts to 22 September/);
  assert.doesNotMatch(html, /posts to \d+ [a-z]{3}\b/);
});

test('a channel with no handle is not introduced as "Found as" nothing', () => {
  const html = renderScreen(onePost as any, oneFacts as any);
  assert.doesNotMatch(html, /Found as\s*(<|\.|on)/);
});

test('the voice sample is their words, not the page chrome', () => {
  const v = voiceSample('Experienced Dog Groomer | PAW-Lished | Shrewsbury Skip to content. ' +
    'Showering your pooch with endless love and care in the salon every single day.');
  assert.doesNotMatch(v, /Skip to content/);
  assert.doesNotMatch(v, /\|/);
  assert.match(v, /Showering your pooch/);
});
