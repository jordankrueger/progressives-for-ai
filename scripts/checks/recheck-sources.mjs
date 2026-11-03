#!/usr/bin/env node
// npm run checks:recheck -- [--write] [--dry-run] [--report <file>] [--today YYYY-MM-DD]
// Monthly re-check of every published check's sources (run by source-recheck-monthly.yml).
// Code fetches each URL (HTTP status, final URL, text); Jev judges whether the page still
// says the quote and still supports the claim.
//
// Nothing negative is written to the site: --write only refreshes the recheck block of a
// source that came back "ok". Down, changed, unreadable or low-confidence sources go only
// into the report (the "Sources need attention" issue). A person sets a warning status in
// the check file; the page shows warning badges only from that.
//
// --dry-run reads pages and Jev answers from tests/checks/fixtures/recheck/ (no network, no
// key, never writes). Key: TYPESAFE_API_KEY only; if unset, exits 0 with a note.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { JEV_USD_PER_M_INPUT, JevError, askJev, noul } from './jev.mjs';
import { CHECKS_DIR, bestExcerpt, checkFiles, fetchSource, loadCheck, quoteFound, replaceSources, today } from './sources.mjs';

// Thresholds are starting points, not calibrated yet (see PIPELINE.md): set them from a
// labeled sample of real sources once the TypeSafe key is in.
export const OK_AT = 0.7; // Jev probability at or above this: still supports the claim
export const CHANGED_BELOW = 0.4; // below this: looks like it no longer says it
export const PAGE_CHARS = 6000; // page text sent to Jev per source
const STALE_DAYS = 40; // last good re-check older than this and failing again: suggest a new source

export const QUESTIONS = {
  says: noul('The web page text in `page` contains the statement in `quote`, word for word or with the same meaning.'),
  supports: noul('The web page text in `page` supports the claim in `claim`.'),
};

const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

// Pure: what one source's re-check found. Returns { recheck } for a source that is fine,
// { problem } otherwise. jev: { says, supports } probabilities, or undefined if not asked.
// "Still says this" goes on the public page only when CODE found the quote on the page:
// Jev is not adversarially robust and a page can be written to sway it, so a model's yes
// alone never produces an "ok". When the quote is missing, Jev's read goes to the issue.
export function assess(source, fetched, jev, { date, quoteOnPage = false }) {
  const base = { date, httpStatus: fetched.status || undefined, finalUrl: fetched.finalUrl !== source.url ? fetched.finalUrl : undefined };
  const last = source.verification?.recheck;
  // Failing again with no good re-check in over a month (or a person already flagged it).
  const stale = Boolean(last) && (last.status !== 'ok' || daysBetween(last.date, date) > STALE_DAYS);
  const problem = (status, detail, confidence = null) => ({
    problem: { status, detail, confidence, httpStatus: fetched.status, finalUrl: fetched.finalUrl, suggestNewSource: stale && (status === 'link-down' || status === 'changed') },
  });
  if (fetched.kind === 'down') return problem('link-down', fetched.error ?? `HTTP ${fetched.status}`);
  if (fetched.kind === 'blocked') return problem('blocked', `HTTP ${fetched.status}: bot wall or paywall, open it by hand`);
  const ok = (recheck) =>
    last && last.status !== 'ok' // a person set a warning: never undo it automatically
      ? problem('person-flagged', `marked "${last.status}" by a person, but the re-check now looks fine; clear it by hand if so`, recheck.jevConfidence)
      : { recheck };
  if (fetched.kind === 'file') return problem('unread-file', `link still loads, needs a person: ${fetched.reason ?? 'text not readable'}`);
  // Compare the raw probability; round only for display.
  const raw = quoteOnPage ? jev.supports : Math.min(jev.says, jev.supports);
  const confidence = Math.round(raw * 100) / 100;
  if (raw < CHANGED_BELOW) return problem('changed', 'Jev says the page no longer says this', confidence);
  if (!quoteOnPage) return problem('quote-missing', 'the quote is not on the page word for word; Jev thinks it still says it, check by hand', confidence);
  if (raw < OK_AT) return problem('low-confidence', 'the quote is there, but Jev is unsure it still supports the claim', confidence);
  return ok({ ...base, status: 'ok', jevConfidence: confidence });
}

const LABEL = { 'unread-file': 'Link loads, text not readable', 'quote-missing': 'Quote not found', 'person-flagged': 'Flagged by a person', 'link-down': 'Link down', blocked: "Couldn't read (bot wall or paywall)", changed: 'May no longer say this', 'low-confidence': 'Low confidence' };

export function reportMarkdown(problems, { date, updated, branch, repo }) {
  const lines = [];
  if (problems.length) {
    lines.push(`The monthly source re-check (${date}) found ${problems.length} source(s) to look at. None of this is on the site: a source's page badge changes only when someone sets its \`verification.recheck.status\` in the check file (\`link-down\`, \`changed\` or \`needs-new-source\`).`, '');
    lines.push('| Check | # | Source | Problem | HTTP | Jev confidence | Suggest |', '|---|---|---|---|---|---|---|');
    for (const p of problems) {
      lines.push(`| ${p.check} | ${p.index + 1} | [${p.title.replace(/\|/g, '/')}](${p.url}) | ${LABEL[p.status]}: ${p.detail} | ${p.httpStatus || 'none'} | ${p.confidence ?? 'n/a'} | ${p.suggestNewSource ? 'Find a new source' : 'Open it and judge'} |`);
    }
  } else {
    lines.push(`The monthly source re-check (${date}) found nothing to fix.`);
  }
  if (updated && branch) {
    lines.push('', `${updated} source(s) came back fine. Their new "last re-checked" dates are on branch \`${branch}\`. To put them on the site, [open the pull request](https://github.com/${repo}/compare/main...${branch}?expand=1) and merge it (one OpenAI review runs on it; see PIPELINE.md).`);
  }
  return `${lines.join('\n')}\n`;
}

async function fixtureFetch(dir) {
  const pages = JSON.parse(await readFile(`${dir}/pages.json`, 'utf8'));
  return async (url) => pages[url] ?? { kind: 'down', status: 404, finalUrl: url };
}

export async function run({ args = process.argv.slice(2), env = process.env, log = console.log, fetchImpl = fetch } = {}) {
  const flag = (name) => args.includes(name);
  const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const dryRun = flag('--dry-run');
  const write = flag('--write') && !dryRun;
  const date = opt('--today') ?? today();
  const fixtures = opt('--fixtures') ?? 'tests/checks/fixtures/recheck';
  const dir = opt('--checks-dir') ?? (dryRun ? `${fixtures}/checks` : CHECKS_DIR);

  let getPage = (url) => fetchSource(url, { fetchImpl });
  let ask = (state) => askJev(state, QUESTIONS, { key: env.TYPESAFE_API_KEY, fetchImpl });
  if (dryRun) {
    getPage = await fixtureFetch(fixtures);
    const answers = JSON.parse(await readFile(`${fixtures}/jev.json`, 'utf8'));
    ask = async (state) => ({ answers: answers[state.quote] ?? { says: 0.5, supports: 0.5 }, inputTokens: 0 });
  } else if (!env.TYPESAFE_API_KEY) {
    log('TYPESAFE_API_KEY is not set: skipping the monthly source re-check. Add it as a repo secret to turn this on.');
    return { skipped: true };
  }

  const problems = [];
  let updated = 0;
  let tokens = 0;
  for (const file of await checkFiles(dir)) {
    const check = await loadCheck(file);
    if (check.data.draft !== false || check.data.category !== 'headline') continue;
    const name = file.split('/').pop().replace(/\.mdx$/, '');
    let changed = false;
    for (const [index, source] of check.sources.entries()) {
      const fetched = await getPage(source.url);
      let jev;
      const quoteOnPage = fetched.kind === 'text' && quoteFound(fetched.text, source.quote);
      if (fetched.kind === 'text') {
        const query = { quote: source.quote, claim: source.supportsClaim };
        const state = { page: bestExcerpt(fetched.text, query, PAGE_CHARS), ...query };
        const r = await ask(state); // a JevError (bad key, outage) stops the run: nothing half-written
        tokens += r.inputTokens;
        jev = r.answers;
      }
      const result = assess(source, fetched, jev, { date, quoteOnPage });
      log(`${result.recheck ? 'ok  ' : 'FLAG'} ${name} #${index + 1} ${source.url}${result.problem ? ` (${result.problem.status})` : ''}`);
      if (result.problem) problems.push({ check: name, index, title: source.title, url: source.url, ...result.problem });
      else {
        source.verification = { ...source.verification, recheck: result.recheck };
        changed = true;
        updated++;
      }
    }
    if (changed && write) await writeFile(file, replaceSources(check.text, check.sources));
  }
  const report = reportMarkdown(problems, { date, updated, branch: opt('--branch'), repo: env.GITHUB_REPOSITORY ?? 'jordankrueger/progressives-for-ai' });
  if (opt('--report')) await writeFile(opt('--report'), report);
  // For the workflow: how many were flagged and how many dates were refreshed.
  if (env.GITHUB_OUTPUT && !dryRun) await appendFile(env.GITHUB_OUTPUT, `flagged=${problems.length}\nupdated=${updated}\n`);
  log(`${updated} ok, ${problems.length} flagged, ${tokens} Jev input tokens (about $${((tokens * JEV_USD_PER_M_INPUT) / 1e6).toFixed(4)})${write ? '' : ' (nothing written)'}`);
  return { problems, updated, tokens, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e instanceof JevError ? `Jev error: ${e.message}` : `error: ${e.message}`);
    process.exit(1);
  });
}
