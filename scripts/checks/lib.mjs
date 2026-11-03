// Checks shared by checks:validate and checks:verify. No model calls, no secrets.
import yaml from 'js-yaml';
import {
  REQUIRED_SECTIONS,
  realityCheckSchema,
  sightingsFileSchema,
} from '../../src/lib/check-scale.mjs';

export function parseMdx(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter block');
  return { data: yaml.load(m[1]), body: m[2] };
}

const zodErrors = (error) => error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);

// Body section titles in order: <h2><span class="num">02</span>Title</h2> or "## Title".
export function sectionTitles(body) {
  const titles = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>|^##\s+(.+)$/gm;
  for (const m of body.matchAll(re)) {
    const raw = m[1] ?? m[2];
    titles.push(raw.replace(/<span class="num">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&#39;|&rsquo;|’/g, "'").trim());
  }
  return titles;
}

export function statCards(body) {
  return [...body.matchAll(/<Stat\b([\s\S]*?)\/>/g)].map((m) => ({
    big: m[1].match(/big="([^"]*)"/)?.[1] ?? '',
    source: m[1].match(/source="([^"]*)"/)?.[1] ?? '',
  }));
}

export function sourcesList(body) {
  const block = body.match(/<Sources\b([\s\S]*?)\/>\s*$/m)?.[1] ?? body.match(/<Sources\b([\s\S]*)/)?.[1] ?? '';
  return [...block.matchAll(/\{([^{}]*)\}/g)]
    .map((m) => ({
      url: m[1].match(/url:\s*['"]([^'"]+)['"]/)?.[1],
      title: m[1].match(/title:\s*(['"])([\s\S]*?)\1\s*,/)?.[2] ?? '',
      original: /original:\s*true/.test(m[1]),
    }))
    .filter((s) => s.url);
}

// Structural checks that need no network. Returns { errors, warnings }.
export function checkStructure(text) {
  const errors = [];
  const warnings = [];
  let parsed;
  try {
    parsed = parseMdx(text);
  } catch (e) {
    return { errors: [e.message], warnings };
  }
  const { data, body } = parsed;
  const fm = realityCheckSchema.safeParse(data);
  if (!fm.success) errors.push(...zodErrors(fm.error).map((e) => `frontmatter ${e}`));
  if (data?.category !== 'headline') errors.push('frontmatter category must be "headline"');

  const titles = sectionTitles(body);
  let last = -1;
  for (const required of REQUIRED_SECTIONS) {
    const at = titles.indexOf(required);
    if (at === -1) errors.push(`missing section "${required}"`);
    else if (at < last) errors.push(`section "${required}" is out of order`);
    else last = at;
  }
  if (!/<TalkingPoints\b/.test(body)) errors.push('missing talking points (<TalkingPoints>)');
  const sources = sourcesList(body);
  if (sources.length === 0) errors.push('missing sources (<Sources>)');
  else if (!sources.some((s) => s.original)) errors.push('no source is marked original: true');
  if (statCards(body).length === 0) warnings.push('no stat cards in "What the evidence actually shows"');
  return { errors, warnings, data, body, sources };
}

const BLOCKED = new Set([401, 402, 403, 406, 429, 451]);

// Fetch each source once. 404/410/5xx/network errors fail; bot walls and paywalls warn.
export async function checkLinks(urls, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const errors = [];
  const warnings = [];
  const texts = new Map();
  for (const url of [...new Set(urls)]) {
    try {
      const res = await fetchImpl(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; progressivesforai-link-check)' },
      });
      if (res.ok) {
        const type = res.headers.get('content-type') ?? '';
        if (type.includes('html') || type.includes('text')) texts.set(url, htmlToText(await res.text()));
      } else if (BLOCKED.has(res.status)) {
        warnings.push(`${url} returned ${res.status} (bot wall or paywall?) - open it by hand`);
      } else {
        errors.push(`${url} returned ${res.status}`);
      }
    } catch (e) {
      errors.push(`${url} did not load: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`);
    }
  }
  return { errors, warnings, texts };
}

export const htmlToText = (html) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

// Numbers in a stat's big value, e.g. "519 ml" -> ["519"], "under 0.2%" -> ["0.2"].
export const statNumbers = (big) => (big.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ''));

// Best effort: warn when a stat's number appears in none of the fetched source texts.
export function checkStatsInSources(stats, texts) {
  const warnings = [];
  if (texts.size === 0) return warnings;
  const haystack = [...texts.values()].join(' ').replace(/,/g, '');
  for (const s of stats) {
    for (const n of statNumbers(s.big)) {
      if (!haystack.includes(n)) warnings.push(`stat "${s.big}": ${n} not found in any fetched source text (PDFs and paywalled pages are not read)`);
    }
  }
  return warnings;
}

const SIGHTINGS_NAME = /^\d{4}-\d{2}-\d{2}\.json$/;
const SHORTLIST_NAME = /^\d{4}-W\d{2}\.md$/;

// Validate one file from the headline-data branch, by its path relative to the data root.
export function validateDataFile(relPath, text) {
  const errors = [];
  const [dir, name] = relPath.split('/');
  if (dir === 'sightings') {
    if (!SIGHTINGS_NAME.test(name)) return [`${relPath}: name must be YYYY-MM-DD.json`];
    let rows;
    try {
      rows = JSON.parse(text);
    } catch (e) {
      return [`${relPath}: not valid JSON (${e.message})`];
    }
    const r = sightingsFileSchema.safeParse(rows);
    if (!r.success) errors.push(...zodErrors(r.error).map((e) => `${relPath}: ${e}`));
    else {
      const day = name.slice(0, 10);
      rows.forEach((row, i) => row.dateSeen !== day && errors.push(`${relPath}: row ${i} dateSeen ${row.dateSeen} is not ${day}`));
    }
  } else if (dir === 'shortlists') {
    if (!SHORTLIST_NAME.test(name)) errors.push(`${relPath}: name must be YYYY-Www.md (ISO week)`);
    else if (!/^# /m.test(text)) errors.push(`${relPath}: needs a "# " title line`);
  }
  return errors;
}
