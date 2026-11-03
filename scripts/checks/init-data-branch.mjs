#!/usr/bin/env node
// npm run checks:init-data-branch [-- --push]
// Creates the orphan branch `headline-data` (README, empty sightings/ and shortlists/,
// validate-data workflow) in a throwaway worktree, so the current checkout is never touched.
// Local only unless --push is given. Refuses if the branch already exists locally or on origin.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BRANCH = 'headline-data';
const push = process.argv.includes('--push');
const repo = resolve(process.argv.find((a) => a.startsWith('--repo='))?.slice(7) ?? '.');
const kit = join(repo, 'docs/headline-checks/data-branch');
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (git(['branch', '--list', BRANCH])) {
  console.error(`${BRANCH} already exists locally; nothing to do.`);
  process.exit(1);
}
try {
  if (git(['ls-remote', '--heads', 'origin', BRANCH])) {
    console.error(`${BRANCH} already exists on origin; fetch it instead: git fetch origin ${BRANCH}`);
    process.exit(1);
  }
} catch {
  console.warn('could not reach origin; continuing with a local-only branch');
}

const dir = mkdtempSync(join(tmpdir(), 'headline-data-'));
try {
  git(['worktree', 'add', '--detach', dir]);
  git(['checkout', '-q', '--orphan', BRANCH], dir);
  git(['rm', '-rfq', '.'], dir);
  cpSync(join(kit, 'README.md'), join(dir, 'README.md'));
  mkdirSync(join(dir, '.github/workflows'), { recursive: true });
  cpSync(join(kit, 'validate-data.yml'), join(dir, '.github/workflows/validate-data.yml'));
  for (const sub of ['sightings', 'shortlists']) {
    mkdirSync(join(dir, sub));
    writeFileSync(join(dir, sub, '.gitkeep'), '');
  }
  git(['add', '.'], dir);
  git(['commit', '-qm', 'Start headline-data: sightings and shortlists for Headline Checks'], dir);
  console.log(`created local branch ${BRANCH} at ${git(['rev-parse', '--short', 'HEAD'], dir)}`);
  if (push) {
    git(['push', '-u', 'origin', BRANCH], dir);
    console.log(`pushed ${BRANCH} to origin`);
  } else {
    console.log(`not pushed. To publish it: git push -u origin ${BRANCH}`);
  }
} finally {
  git(['worktree', 'remove', '--force', dir]);
  rmSync(dir, { recursive: true, force: true });
}
