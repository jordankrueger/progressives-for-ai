#!/usr/bin/env node
// npm run checks:verify [-- files...] [--offline]
// Checks headline-check MDX files: frontmatter + verdict scale, required sections in order,
// talking points, sources (one marked original), every source link loads, and (warn only)
// stat-card numbers appear in a fetched source. Defaults to every file in the checks folder.
// --offline (or CHECKS_OFFLINE=1) skips the network checks.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkLinks, checkStatsInSources, checkStructure, statCards } from './lib.mjs';

const CHECKS_DIR = 'src/content/reality-check/checks';
const args = process.argv.slice(2);
const offline = args.includes('--offline') || process.env.CHECKS_OFFLINE === '1';
let files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) files = (await readdir(CHECKS_DIR)).filter((f) => f.endsWith('.mdx')).map((f) => join(CHECKS_DIR, f));

let failed = false;
for (const file of files) {
  const { errors, warnings, body, sources = [] } = checkStructure(await readFile(file, 'utf8'));
  if (!offline && sources.length) {
    const links = await checkLinks(sources.map((s) => s.url));
    errors.push(...links.errors);
    warnings.push(...links.warnings, ...checkStatsInSources(statCards(body), links.texts));
  }
  console.log(`${errors.length ? 'FAIL' : 'ok  '} ${file}${offline ? ' (offline: links not checked)' : ''}`);
  for (const e of errors) console.log(`  error: ${e}`);
  for (const w of warnings) console.log(`  warn:  ${w}`);
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);
