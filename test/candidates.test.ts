import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * From the first real run, 15 September. A search for "barber Shrewsbury"
 * offered two competitors: the Wikipedia page for Sir Henry Barber, 1st
 * Baronet, and a Massachusetts directory listing. Both passed every filter the
 * agent had, because the relevance test asks whether the trade word appears
 * anywhere and "Barber" was his surname.
 */
const NEVER_A_BUSINESS = [
  "wikipedia.org", "wikimedia.org", "britannica.com", "linkedin.com/in/",
  "reddit.com", "quora.com", "youtube.com", "pinterest.", "amazon.",
  "gov.uk", "companieshouse", "indeed.com", "glassdoor",
];
const WRONG_COUNTRY =
  /\b(MA|PA|NJ|NY|CA|TX|FL|Massachusetts|Pennsylvania|New Jersey|Missouri)\b/;

const keep = (url: string, name: string) => {
  if (NEVER_A_BUSINESS.some((h) => url.toLowerCase().includes(h))) return false;
  if (WRONG_COUNTRY.test(`${url} ${name}`)) return false;
  if (/\b(best|top|10|ten|near me|directory|guide)\b/i.test(name)) return false;
  return true;
};

test("a dead baronet is not a barber", () => {
  assert.equal(
    keep("https://en.wikipedia.org/wiki/Henry_Barber", "Sir Henry Barber, 1st Baronet"),
    false,
  );
});

test("a town of the same name in another country is thrown out", () => {
  assert.equal(keep("https://vagaro.com/x", "Best Barbers In Shrewsbury, MA"), false);
  assert.equal(keep("https://example.com", "Joe's Barbers, Shrewsbury PA"), false);
});

test("a listicle is a list, however many businesses it names", () => {
  assert.equal(keep("https://example.co.uk/x", "The 10 best barbers in Shrewsbury"), false);
  assert.equal(keep("https://example.co.uk/x", "Top barbers near me"), false);
});

test("a real local business survives all of it", () => {
  assert.equal(keep("https://hinces.co.uk", "HINCES Barber"), true);
  assert.equal(keep("https://booksy.com/en-gb/12884_hinces_barber_1227928_shrewsbury", "HINCES"), true);
});

test("the filter is not so keen it removes everyone", () => {
  // A guard that rejects everything passes every test about rejecting things
  // and makes the product useless. This is the assertion that notices.
  const realistic = [
    ["https://thefadeinn.co.uk", "The Fade Inn"],
    ["https://booksy.com/en-gb/8821_no-1-barbers_shrewsbury", "NO.1 Barbers"],
    ["https://fresha.com/a/barbering-aj-shrewsbury", "Barbering AJ"],
  ];
  assert.equal(realistic.filter(([u, n]) => keep(u, n)).length, 3);
});
