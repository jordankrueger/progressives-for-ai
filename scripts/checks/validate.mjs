#!/usr/bin/env node
// npm run checks:validate [-- <data-dir>]
// Validates the headline-data files (sightings/*.json, shortlists/*.md) in <data-dir>
// (default: $HEADLINE_DATA_DIR, else ./headline-data), plus the frontmatter of every check
// in src/content/reality-check/checks/. Exit 1 on any error. No network.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkStructure, validateDataFile } from './lib.mjs';

const dataDir = process.argv[2] ?? process.env.HEADLINE_DATA_DIR ?? 'headline-data';
const CHECKS_DIR = 'src/content/reality-check/checks';
const errors = [];
let count = 0;

if (existsSync(dataDir)) {
  for (const sub of ['sightings', 'shortlists']) {
    const dir = join(dataDir, sub);
    if (!existsSync(dir)) continue;
    for (const name of await readdir(dir)) {
      if (name.startsWith('.')) continue;
      count++;
      errors.push(...validateDataFile(`${sub}/${name}`, await readFile(join(dir, name), 'utf8')));
    }
  }
} else {
  console.log(`no data dir at ${dataDir}; skipping sightings and shortlists`);
}

if (existsSync(CHECKS_DIR)) {
  for (const name of (await readdir(CHECKS_DIR)).filter((f) => f.endsWith('.mdx'))) {
    count++;
    const r = checkStructure(await readFile(join(CHECKS_DIR, name), 'utf8'));
    errors.push(...r.errors.filter((e) => e.startsWith('frontmatter') || e.startsWith('no frontmatter')).map((e) => `${CHECKS_DIR}/${name}: ${e}`));
  }
}

for (const e of errors) console.log(`error: ${e}`);
console.log(`${count} file(s) checked, ${errors.length} error(s)`);
process.exit(errors.length ? 1 : 0);
