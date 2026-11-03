// Source checks: schema publishing rules, frontmatter rewrite, monthly Jev re-check and the
// ChatGPT check. No network: every fetch (pages, Jev, OpenAI) is a mock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkStructure } from '../../scripts/checks/lib.mjs';
import { askJev, JEV_ENDPOINT } from '../../scripts/checks/jev.mjs';
import { assess, run as recheck } from '../../scripts/checks/recheck-sources.mjs';
import { run as chatgpt } from '../../scripts/checks/source-check-chatgpt.mjs';
import { quoteFound, readCheck, replaceSources } from '../../scripts/checks/sources.mjs';
import { sourceFingerprint, sourceIssues } from '../../src/lib/check-scale.mjs';

const sample = readFileSync('src/content/reality-check/checks/bottle-of-water.mdx', 'utf8');
const quiet = () => {};

const src = (over = {}) => ({
  url: 'https://a.test/s',
  title: 'T',
  outlet: 'O',
  date: '2025',
  type: 'survey',
  isOriginal: true,
  supportsClaim: 'claim',
  quote: 'quote',
  verification: { haiku: { date: '2026-11-01', result: 'supports' }, chatgpt: { date: '2026-11-01', result: 'supports' } },
  ...over,
});

test('publishing rules: both model checks required, doesnt-support and sample block, drafts exempt', () => {
  assert.deepEqual(sourceIssues([src()], { draft: false }), []);
  assert.deepEqual(sourceIssues([src({ verification: {} })], { draft: true }), []);
  const noChatgpt = sourceIssues([src({ verification: { haiku: { date: '2026-11-01', result: 'supports' } } })], { draft: false });
  assert.equal(noChatgpt.length, 1);
  assert.match(noChatgpt[0], /no chatgpt check/);
  const bad = src();
  bad.verification.haiku.result = 'doesnt-support';
  assert.match(sourceIssues([bad], { draft: false })[0], /haiku says this source doesn't support/);
  assert.equal(sourceIssues([src({ verification: { ...src().verification, sample: true } })], { draft: false }).length, 1);
  assert.match(sourceIssues([src({ isOriginal: false })], { draft: true })[0], /first source must be the original/);
});

test('a model check is stale once the url, quote or claim changes', () => {
  const s = src();
  s.verification.chatgpt.for = sourceFingerprint(s);
  assert.deepEqual(sourceIssues([s], { draft: false }), []);
  s.quote = 'a different quote';
  assert.match(sourceIssues([s], { draft: false })[0], /chatgpt check is stale/);
});

test('the sample check cannot be published as is (sample verification)', () => {
  const r = checkStructure(sample.replace('draft: true', 'draft: false'));
  assert.ok(r.errors.some((e) => e.includes("sample verification can't be published")), r.errors.join('\n'));
});

test('sources section must sit after the evidence; citations must point at a source', () => {
  const moved = sample.replace('<CheckSources sources={frontmatter.sources} num="04" />', '').replace('<TalkingPoints', '<CheckSources sources={frontmatter.sources} />\n\n<TalkingPoints');
  assert.ok(checkStructure(moved).errors.some((e) => e.includes('must sit right after')));
  const missing = sample.replace('<CheckSources sources={frontmatter.sources} num="04" />', '');
  assert.ok(checkStructure(missing).errors.some((e) => e.includes('missing the sources section')));
  const pastEnd = sample.replace('href="#source-3">3<', 'href="#source-9">9<');
  assert.ok(checkStructure(pastEnd).errors.includes('citation #source-9 points past the 4 sources'));
});

test('replaceSources rewrites only the sources block', () => {
  const { sources } = readCheck(sample);
  sources[1].verification.recheck = { date: '2026-12-01', status: 'ok', jevConfidence: 0.5 };
  const out = replaceSources(sample, sources);
  assert.equal(readCheck(out).sources[1].verification.recheck.date, '2026-12-01');
  const strip = (t) => t.replace(/^sources:\n(?:[ -].*\n)*/m, '');
  assert.equal(strip(out), strip(sample)); // everything outside the block is byte for byte the same
  assert.deepEqual(checkStructure(out).errors, []);
});

test('quote matching folds case, curly quotes and whitespace', () => {
  assert.ok(quoteFound('He said “AI uses   water” today', '"ai uses water"'));
  assert.ok(quoteFound('the footprint  of AI has largely remained under the radar.', 'footprint of AI has largely remained under the radar.'));
  assert.ok(!quoteFound('nothing here', 'under the radar'));
});

test('assess: ok, down, blocked, file, changed, low confidence', () => {
  const s = src({ verification: { recheck: { date: '2026-08-01', status: 'ok', jevConfidence: 0.9 } } });
  const at = { date: '2026-11-01' };
  const html = { kind: 'html', status: 200, finalUrl: s.url };
  assert.equal(assess(s, html, { says: 0.9, supports: 0.8 }, at).recheck.jevConfidence, 0.8);
  const down = assess(s, { kind: 'down', status: 404, finalUrl: s.url }, undefined, at).problem;
  assert.equal(down.status, 'link-down');
  assert.equal(down.suggestNewSource, true); // last good re-check was three months ago
  assert.equal(assess(src(), { kind: 'down', status: 0, finalUrl: s.url, error: 'timed out' }, undefined, at).problem.suggestNewSource, false);
  assert.equal(assess(s, { kind: 'blocked', status: 403, finalUrl: s.url }, undefined, at).problem.status, 'blocked');
  assert.equal(assess(s, { kind: 'file', status: 200, finalUrl: s.url }, undefined, at).recheck.jevConfidence, null);
  assert.equal(assess(s, html, { says: 0.2, supports: 0.9 }, at).problem.status, 'changed');
  assert.equal(assess(s, html, { says: 0.6, supports: 0.9 }, at).problem.status, 'low-confidence');
});

test('assess never overwrites a warning a person set, even if the page looks fine now', () => {
  const s = src({ verification: { recheck: { date: '2026-10-01', status: 'changed' } } });
  const r = assess(s, { kind: 'html', status: 200, finalUrl: s.url }, { says: 0.95, supports: 0.95 }, { date: '2026-11-01' });
  assert.equal(r.recheck, undefined);
  assert.equal(r.problem.status, 'person-flagged');
});

const json = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k] ?? null },
  json: async () => body,
});

test('askJev: request shape from jev.py, retries 429, never leaks the key', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) return json(429, {}, { 'retry-after': '0' });
    return json(200, { answers: { says: { type: 'noul', noul: 0.91 } }, usage: { input_tokens: 1200 } });
  };
  const r = await askJev({ page: 'p' }, { says: { type: 'noul', instructions: 'x' } }, { key: 'sk-test-secret', fetchImpl, sleep: async () => {} });
  assert.equal(r.answers.says, 0.91);
  assert.equal(r.inputTokens, 1200);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, JEV_ENDPOINT);
  assert.equal(calls[1].init.headers.authorization, 'Bearer sk-test-secret');
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.model, 'jev-latest');
  assert.deepEqual(Object.keys(body), ['state', 'model', 'questions']);
  await assert.rejects(
    askJev({}, { says: {} }, { key: 'sk-test-secret', fetchImpl: async () => json(401, {}) }),
    (e) => e.message === 'TypeSafe returned HTTP 401' && !e.message.includes('sk-test'),
  );
  await assert.rejects(askJev({}, { says: {} }, { key: '' }), /TYPESAFE_API_KEY is not set/);
});

const page = (status, text, type = 'text/html') => ({
  ok: status >= 200 && status < 300,
  status,
  url: '',
  headers: { get: () => type },
  text: async () => `<html><body><p>${text}</p></body></html>`,
});

function tempChecks() {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-'));
  cpSync('tests/checks/fixtures/recheck/checks', dir, { recursive: true });
  return dir;
}

test('monthly re-check: writes only ok results, reports the rest, skips drafts', async () => {
  const dir = tempChecks();
  const before = readCheck(readFileSync(join(dir, 'published.mdx'), 'utf8')).sources;
  const fetchImpl = async (url, init) => {
    if (url === JEV_ENDPOINT) {
      const { state } = JSON.parse(init.body);
      const p = state.quote.includes('golf') ? 0.1 : 0.95;
      return json(200, { answers: { says: { type: 'noul', noul: p }, supports: { type: 'noul', noul: p } }, usage: { input_tokens: 500 } });
    }
    if (url.endsWith('/gone')) return page(404, '');
    if (url.endsWith('.pdf')) return page(200, '', 'application/pdf');
    if (url.endsWith('/draft-only')) throw new Error('drafts must not be fetched');
    return page(200, url.endsWith('/study') ? 'about 519 milliliters per email' : 'golf is not mentioned');
  };
  const r = await recheck({ args: ['--write', '--checks-dir', dir, '--today', '2026-11-01'], env: { TYPESAFE_API_KEY: 'k' }, fetchImpl, log: quiet });
  assert.equal(r.updated, 2);
  assert.deepEqual(r.problems.map((p) => p.status), ['link-down', 'changed']);
  assert.equal(r.problems[1].confidence, 0.1);
  assert.equal(r.problems[0].httpStatus, 404);
  const after = readCheck(readFileSync(join(dir, 'published.mdx'), 'utf8')).sources;
  assert.equal(after[0].verification.recheck.status, 'ok');
  assert.equal(after[0].verification.recheck.date, '2026-11-01');
  assert.equal(after[3].verification.recheck.jevConfidence, null);
  assert.deepEqual(after[1].verification.recheck, before[1].verification.recheck); // down: untouched
  assert.equal(after[2].verification.recheck, undefined); // changed: nothing written
  assert.match(r.report, /A page that went away/);
  assert.match(r.report, /None of this is on the site/);
  rmSync(dir, { recursive: true });
});

test('monthly re-check: no key means a clean skip; dry run writes nothing', async () => {
  const r = await recheck({ args: [], env: {}, fetchImpl: async () => { throw new Error('no network'); }, log: quiet });
  assert.equal(r.skipped, true);
  const dir = tempChecks();
  const original = readFileSync(join(dir, 'published.mdx'), 'utf8');
  const dry = await recheck({ args: ['--dry-run', '--write', '--checks-dir', dir], env: {}, fetchImpl: async () => { throw new Error('no network'); }, log: quiet });
  assert.equal(dry.problems.length, 2);
  assert.equal(readFileSync(join(dir, 'published.mdx'), 'utf8'), original);
  rmSync(dir, { recursive: true });
});

test('ChatGPT check: capped, writes the chatgpt block with a fingerprint, skips current ones next time', async () => {
  const dir = tempChecks();
  const file = join(dir, 'published.mdx');
  const bodies = [];
  const fetchImpl = async (url, init) => {
    if (url === 'https://api.openai.com/v1/responses') {
      const body = JSON.parse(init.body);
      bodies.push(body);
      const result = body.input.includes('Golf') ? 'doesnt-support' : 'supports';
      return json(200, { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ result, quoteFound: true, note: 'n' }) }] }], usage: { input_tokens: 900, output_tokens: 30 } });
    }
    if (url.endsWith('/gone')) return page(404, '');
    if (url.endsWith('.pdf')) return page(200, '', 'application/pdf');
    return page(200, 'about 519 milliliters per email');
  };
  const first = await chatgpt({ args: [file, '--write', '--max-sources', '1', '--today', '2026-11-03'], env: { OPENAI_API_KEY: 'k' }, fetchImpl, log: quiet });
  assert.equal(first.sent, 1);
  assert.equal(first.skippedForCap, 3); // the cap is counted before fetching: sources 2-4 wait for the next run
  assert.equal(bodies[0].max_output_tokens, 300);
  assert.equal(bodies[0].model, 'gpt-5.4-mini');
  assert.equal(bodies[0].text.format.type, 'json_schema');
  assert.ok(bodies[0].input.length < 13000);
  let s = readCheck(readFileSync(file, 'utf8')).sources;
  assert.equal(s[0].verification.chatgpt.result, 'supports');
  assert.equal(s[0].verification.chatgpt.for, sourceFingerprint(s[0]));
  const second = await chatgpt({ args: [file, '--write', '--today', '2026-11-03'], env: { OPENAI_API_KEY: 'k' }, fetchImpl, log: quiet });
  assert.equal(second.sent, 1); // only source 3; source 1 is current
  s = readCheck(readFileSync(file, 'utf8')).sources;
  assert.equal(s[2].verification.chatgpt.result, 'doesnt-support');
  assert.match(second.comment, /blocks publishing/);
  rmSync(dir, { recursive: true });
});
