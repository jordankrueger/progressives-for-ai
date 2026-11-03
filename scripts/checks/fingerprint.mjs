#!/usr/bin/env node
// npm run checks:fingerprint -- <check.mdx> [--stamp haiku]
// Prints each source's fingerprint (url + quote + claim). With --stamp haiku, writes it into
// every haiku block that has none, so the Haiku result is tied to the exact source it read.
// Run --stamp right after recording the Haiku results, before editing any source: a later
// edit then makes the result stale and blocks publishing until Haiku checks it again.
import { readFile, writeFile } from 'node:fs/promises';
import { sourceFingerprint } from '../../src/lib/check-scale.mjs';
import { readCheck, replaceSources } from './sources.mjs';

export function stamp(text, model) {
  const { sources } = readCheck(text);
  let n = 0;
  for (const s of sources) {
    const c = s.verification?.[model];
    if (c && !c.for) { c.for = sourceFingerprint(s); n++; }
  }
  return { text: n ? replaceSources(text, sources) : text, stamped: n };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => a.endsWith('.mdx'));
  if (!file) { console.error('usage: checks:fingerprint -- <check.mdx> [--stamp haiku]'); process.exit(1); }
  const text = await readFile(file, 'utf8');
  if (args.includes('--stamp')) {
    const model = args[args.indexOf('--stamp') + 1];
    if (model !== 'haiku') { console.error('--stamp only takes "haiku" (the ChatGPT workflow stamps its own results)'); process.exit(1); }
    const r = stamp(text, model);
    if (r.stamped) await writeFile(file, r.text);
    console.log(`stamped ${r.stamped} haiku result(s) in ${file}`);
  } else {
    readCheck(text).sources.forEach((s, i) => console.log(`source ${i + 1}: ${sourceFingerprint(s)}  ${s.url}`));
  }
}
