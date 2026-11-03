// npm run test:checks — no network; fetch is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  checkLinks,
  checkStatsInSources,
  checkStructure,
  statCards,
  statNumbers,
  validateDataFile,
} from '../../scripts/checks/lib.mjs';
import { draftsVisible, tallyText } from '../../src/lib/check-scale.mjs';

const sample = readFileSync('src/content/reality-check/checks/bottle-of-water.mdx', 'utf8');

test('sample check passes the structure check', () => {
  const r = checkStructure(sample);
  assert.deepEqual(r.errors, []);
  assert.equal(r.sources.length, 5);
  assert.equal(r.sources.filter((s) => s.original).length, 1);
});

test('verdict off the scale fails', () => {
  const r = checkStructure(sample.replace('verdict: "overblown"', 'verdict: "false"'));
  assert.ok(r.errors.some((e) => e.includes('verdict')), r.errors.join('\n'));
});

test('missing "What the headline gets right" fails', () => {
  const r = checkStructure(sample.replace('What the headline gets right', 'Some other heading'));
  assert.ok(r.errors.includes('missing section "What the headline gets right"'), r.errors.join('\n'));
});

test('sections out of order fail', () => {
  const swapped = sample
    .replace('Where the claim came from', 'TMP')
    .replace("What we're not sure about", 'Where the claim came from')
    .replace('TMP', "What we're not sure about");
  const r = checkStructure(swapped);
  assert.ok(r.errors.some((e) => e.includes('out of order')), r.errors.join('\n'));
});

test('no source marked original fails', () => {
  const r = checkStructure(sample.replace('original: true,', ''));
  assert.ok(r.errors.includes('no source is marked original: true'));
});

test('short version must be exactly three lines', () => {
  const r = checkStructure(sample.replace(/  - "The real water problem is local[^\n]*\n/, ''));
  assert.ok(r.errors.some((e) => e.includes('shortVersion')), r.errors.join('\n'));
});

const res = (status, body = '', type = 'text/html') => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => type },
  text: async () => body,
});

test('link check: 404 and network errors fail, 403 warns, 200 passes and keeps text', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/gone')) return res(404);
    if (url.endsWith('/walled')) return res(403);
    if (url.endsWith('/down')) throw new Error('ECONNREFUSED');
    return res(200, '<p>Golf uses 476 billion gallons</p>');
  };
  const r = await checkLinks(['https://a.test/ok', 'https://a.test/gone', 'https://a.test/walled', 'https://a.test/down'], { fetchImpl });
  assert.equal(r.errors.length, 2);
  assert.ok(r.errors[0].includes('404'));
  assert.ok(r.errors[1].includes('ECONNREFUSED'));
  assert.equal(r.warnings.length, 1);
  assert.ok(r.texts.get('https://a.test/ok').includes('476 billion'));
});

test('stat numbers: found in a source passes, missing warns', () => {
  assert.deepEqual(statNumbers('117 trillion gal'), ['117']);
  assert.deepEqual(statNumbers('1,468 ml or 0.2%'), ['1468', '0.2']);
  const texts = new Map([['u', 'about 519 ml of water and 1,468 ml in Washington']]);
  assert.deepEqual(checkStatsInSources([{ big: '519 ml' }, { big: '1,468 ml' }], texts), []);
  assert.equal(checkStatsInSources([{ big: '700 ml' }], texts).length, 1);
  assert.deepEqual(checkStatsInSources([{ big: '700 ml' }], new Map()), []); // nothing fetched: no claim either way
  assert.equal(statCards(sample).length, 3);
});

const row = (over = {}) => ({
  headline: 'AI is draining the lakes',
  outlet: 'Example News',
  url: 'https://news.example/story',
  where: 'r/technology',
  dateSeen: '2026-11-03',
  claimId: 'ai-drains-lakes',
  ...over,
});

test('sightings file: valid rows pass', () => {
  assert.deepEqual(validateDataFile('sightings/2026-11-03.json', JSON.stringify([row(), row({ where: 'r/news', upvotes: 1200 })])), []);
});

test('sightings file: bad name, bad JSON, wrong day, unknown field and bad claimId fail', () => {
  assert.equal(validateDataFile('sightings/nov-3.json', '[]').length, 1);
  assert.ok(validateDataFile('sightings/2026-11-03.json', '{oops')[0].includes('not valid JSON'));
  assert.ok(validateDataFile('sightings/2026-11-03.json', JSON.stringify([row({ dateSeen: '2026-11-02' })]))[0].includes('is not 2026-11-03'));
  assert.equal(validateDataFile('sightings/2026-11-03.json', JSON.stringify([row({ posterName: 'someone' })])).length, 1);
  assert.equal(validateDataFile('sightings/2026-11-03.json', JSON.stringify([row({ claimId: 'Not Kebab' })])).length, 1);
  assert.equal(validateDataFile('sightings/2026-11-03.json', JSON.stringify([row({ url: 'javascript:alert(1)' })])).length, 1);
});

test('check urls must be http(s)', () => {
  const r = checkStructure(sample.replace(/^url: ".*"$/m, 'url: "javascript:alert(1)"'));
  assert.ok(r.errors.some((e) => e.includes('frontmatter url')), r.errors.join('\n'));
});

test('shortlist file: needs ISO-week name and a title', () => {
  assert.deepEqual(validateDataFile('shortlists/2026-W45.md', '# Headline candidates, week of 2026-11-02\n'), []);
  assert.equal(validateDataFile('shortlists/2026-11-02.md', '# x').length, 1);
  assert.equal(validateDataFile('shortlists/2026-W45.md', 'no title').length, 1);
});

test('drafts show in dev, on preview branches and with SHOW_DRAFTS=1, never on main', () => {
  assert.equal(draftsVisible({ dev: true }), true);
  assert.equal(draftsVisible({ env: { CF_PAGES_BRANCH: 'headline-checks' } }), true);
  assert.equal(draftsVisible({ env: { SHOW_DRAFTS: '1' } }), true);
  assert.equal(draftsVisible({ env: { CF_PAGES_BRANCH: 'main' } }), false);
  assert.equal(draftsVisible({ env: {} }), false);
});

test('tally text', () => {
  assert.equal(tallyText([]), '0 checked');
  assert.equal(tallyText(['holds-up']), '1 checked: 1 holds up');
  assert.equal(
    tallyText(['overblown', 'holds-up', 'overblown', 'doesnt-hold-up', 'doesnt-hold-up']),
    "5 checked: 1 holds up, 2 overblown, 2 don't hold up",
  );
});
