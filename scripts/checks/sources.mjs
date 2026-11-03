// Shared by the source checks (ChatGPT on PRs, monthly Jev re-check): read and write a
// check's `sources:` frontmatter, fetch a source page, find its quote. No secrets here.
import yaml from 'js-yaml';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sourceSchema } from '../../src/lib/check-scale.mjs';
import { htmlToText, parseMdx } from './lib.mjs';

export const CHECKS_DIR = 'src/content/reality-check/checks';
export const BLOCKED = new Set([401, 402, 403, 406, 429, 451]);
export const today = () => new Date().toISOString().slice(0, 10);

export async function checkFiles(dir = CHECKS_DIR) {
  return (await readdir(dir)).filter((f) => f.endsWith('.mdx')).map((f) => join(dir, f));
}

// { data, sources } with sources parsed by the shared schema (dates as YYYY-MM-DD strings).
export function readCheck(text) {
  const { data } = parseMdx(text);
  return { data, sources: (data.sources ?? []).map((s) => sourceSchema.parse(s)) };
}

export const loadCheck = async (file) => {
  const text = await readFile(file, 'utf8');
  return { file, text, ...readCheck(text) };
};

// Replace only the top-level `sources:` block of the frontmatter, leaving every other line
// exactly as written (a full YAML round-trip would rewrite dates and quoting everywhere).
export function replaceSources(text, sources) {
  const end = text.indexOf('\n---', 4);
  if (!text.startsWith('---\n') || end === -1) throw new Error('no frontmatter block');
  const fm = text.slice(4, end + 1);
  const lines = fm.split('\n');
  const start = lines.findIndex((l) => /^sources:\s*$/.test(l));
  if (start === -1) throw new Error('frontmatter has no "sources:" block');
  let stop = start + 1;
  // The block is its own indented or "- " lines; an unindented line (next key or comment) ends it.
  while (stop < lines.length && (lines[stop] === '' || /^[\s-]/.test(lines[stop]))) stop++;
  // Trailing blank lines belong to whatever follows.
  while (stop > start + 1 && lines[stop - 1] === '') stop--;
  const block = yaml.dump({ sources }, { lineWidth: -1, noRefs: true, quotingType: '"' }).trimEnd();
  lines.splice(start, stop - start, ...block.split('\n'));
  return `---\n${lines.join('\n')}${text.slice(end + 1)}`;
}

// Fold case, curly quotes, dashes and whitespace so a quote matches the page it came from.
export const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&#34;|&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export function quoteFound(text, quote) {
  const needle = normalize(quote).replace(/[.\s]+$/, '');
  return needle.length >= 3 && normalize(text).includes(needle); // an empty needle would match every page
}

// The part of the page a model reads: a window around the quote if it is there, else the top.
export function clipAround(text, quote, maxChars) {
  if (text.length <= maxChars) return text;
  const at = normalize(text).indexOf(normalize(quote).slice(0, 60));
  // normalize() can shorten the text a little, so the index is approximate; the window is wide.
  if (at === -1) return text.slice(0, maxChars);
  const from = Math.max(0, Math.min(at - Math.floor(maxChars / 2), text.length - maxChars));
  return text.slice(from, from + maxChars);
}

// The passages most likely to bear on a quote/claim, for a model to read: a window around
// the quote when it is on the page; otherwise the chunks sharing the most words with it,
// kept in page order. Small on purpose: Jev gets worse with large irrelevant text.
export function bestExcerpt(text, query, maxChars) {
  if (text.length <= maxChars) return text;
  if (quoteFound(text, query.quote)) return clipAround(text, query.quote, maxChars);
  const words = new Set(normalize(`${query.quote} ${query.claim ?? ''}`).match(/[a-z0-9.%]{4,}/g) ?? []);
  const size = 600;
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size);
    const have = new Set(normalize(chunk).match(/[a-z0-9.%]{4,}/g) ?? []);
    chunks.push({ i, chunk, score: [...words].filter((w) => have.has(w)).length });
  }
  const keep = chunks.sort((a, b) => b.score - a.score).slice(0, Math.floor(maxChars / (size + 3))).sort((a, b) => a.i - b.i);
  return keep.map((c) => c.chunk).join(' … ');
}

// Fetch one source. kind: html (text read) | file (PDF etc., not read) | blocked | down.
export async function fetchSource(url, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; progressivesforai-source-check)' },
    });
    const finalUrl = res.url || url;
    if (BLOCKED.has(res.status)) return { kind: 'blocked', status: res.status, finalUrl };
    if (!res.ok) return { kind: 'down', status: res.status, finalUrl };
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('html') || type.startsWith('text/')) {
      return { kind: 'html', status: res.status, finalUrl, text: htmlToText(await res.text()) };
    }
    return { kind: 'file', status: res.status, finalUrl, contentType: type };
  } catch (e) {
    return { kind: 'down', status: 0, finalUrl: url, error: e.name === 'TimeoutError' ? 'timed out' : e.message };
  }
}
