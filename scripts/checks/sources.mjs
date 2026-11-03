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

export const MAX_BYTES = 30 * 1024 * 1024; // any source body, web page or PDF
export const PDF_LIMITS = { maxPages: 80, maxChars: 400000, timeoutMs: 30000, memoryMb: 256 };
const MIN_REAL_WORDS = 6; // fewer real words than this: a scan with a stamped page number at most

// Words of 3+ letters. A stamped "Page 1 of 12" has one; a real sentence has several.
const realWords = (text) => text.match(/\p{L}{3,}/gu) ?? [];

// Text of a PDF, read in a worker thread with a deadline, a memory cap and a page cap, so a
// slow or hostile file can't stall the job. null when it has no real text layer (a scan).
// Throws on a parse error or the deadline.
export async function pdfText(bytes, limits = PDF_LIMITS) {
  const { Worker } = await import('node:worker_threads');
  const worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url), {
    workerData: { bytes, maxPages: limits.maxPages, maxChars: limits.maxChars },
    resourceLimits: { maxOldGenerationSizeMb: limits.memoryMb },
  });
  let timer;
  try {
    const result = await Promise.race([
      new Promise((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', (code) => reject(new Error(`PDF reader stopped (exit ${code})`)));
      }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PDF took too long to read')), limits.timeoutMs); }),
    ]);
    if (result.error) throw new Error(`PDF couldn't be parsed (${result.error})`);
    const clean = result.text.replace(/\s+/g, ' ').trim();
    return realWords(clean).length >= MIN_REAL_WORDS ? clean : null;
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

// Read a response body, stopping as soon as it passes `cap` bytes. null when too big.
export async function readCapped(res, cap = MAX_BYTES) {
  const declared = Number(res.headers.get('content-length'));
  if (declared > cap) { await res.body?.cancel?.(); return null; }
  if (!res.body?.getReader) {
    const buf = res.arrayBuffer ? new Uint8Array(await res.arrayBuffer()) : new TextEncoder().encode(await res.text());
    return buf.byteLength > cap ? null : buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

const isPdf = (bytes) => new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-');

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
    const bytes = await readCapped(res);
    if (!bytes) return { kind: 'file', status: res.status, finalUrl, contentType: type, reason: 'over 30 MB, not read' };
    // Check the bytes, not the label: a PDF served as text/plain must still go through the PDF path.
    if (isPdf(bytes)) {
      let text;
      try {
        text = await pdfText(bytes);
      } catch (e) {
        return { kind: 'file', status: res.status, finalUrl, contentType: type, reason: e.message };
      }
      if (text) return { kind: 'text', status: res.status, finalUrl, text, format: 'pdf' };
      return { kind: 'file', status: res.status, finalUrl, contentType: type, reason: 'PDF has no text layer (scanned or image-only)' };
    }
    if (type.includes('html') || type.startsWith('text/')) {
      return { kind: 'text', status: res.status, finalUrl, text: htmlToText(new TextDecoder().decode(bytes)) };
    }
    return { kind: 'file', status: res.status, finalUrl, contentType: type, reason: `not a web page or PDF (${type || 'unknown type'})` };
  } catch (e) {
    return { kind: 'down', status: 0, finalUrl: url, error: e.name === 'TimeoutError' ? 'timed out' : e.message };
  }
}
