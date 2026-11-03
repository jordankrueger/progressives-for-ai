# Headline Checks pipeline

How a viral AI headline becomes a published check. Three scheduled Claude Code routines
(Anthropic cloud, on Jordan's Claude plan) do the finding and drafting against this repo.
Nothing runs on the Mac Mini. Jordan publishes.

## Cost warning: pull requests against main start two paid reviews

`.github/workflows/ai-code-review.yml` runs on **every pull request into `main`**, for the
`opened`, `synchronize` (each new push to the PR branch) and `reopened` events. It has **no
path filter and no draft filter**, so a draft PR that only adds one `.mdx` file still triggers it.
Each trigger runs two paid jobs, billed to the API keys in the repo secrets:

1. **OpenAI Logic Review**: one Responses API call to `gpt-5.3-codex` with the PR diff plus the
   full text of each changed file (capped at 350,000 characters, about 90K tokens). A one-file
   check is about 7 to 15 KB of MDX (the sample is 6.9 KB), sent twice (full file and diff),
   so roughly 4K to 8K input tokens plus the fixed review prompt.
2. **Anthropic Security Review**: the `anthropics/claude-code-security-review` action, a Claude
   Code session of up to 8 minutes using `ANTHROPIC_API_KEY`.

So one research PR costs **two paid reviews when opened, plus two more for every later push**
to its branch. The `concurrency` setting cancels an in-progress run when a new push arrives,
but a cancelled run may already have spent tokens. Per-run dollar cost is not knowable from the
repo: read it from the OpenAI and Anthropic usage pages after the first research PR.

What does not cost anything: pushes to `headline-data` or to `check/*` branches without a PR,
the `headline-checks.yml` and `validate-data.yml` workflows (free on a public repo), and the
Cloudflare Pages preview build that every branch push gets.

Ways to cut it, if wanted (not done; `ai-code-review.yml` is untouched): add
`paths-ignore: ['src/content/reality-check/checks/**']` to its `pull_request` trigger, or skip
draft PRs with `if: github.event.pull_request.draft == false` on both jobs, or have the research
routine push the `check/` branch without opening a PR and link the preview URL in the issue.

## The three plug-in points

Runner: three Claude Code routines on Jordan's Claude plan. Prompts are in `tasks/`.
None of them is scheduled yet.

1. **Find candidates.** `tasks/watcher.md`, daily, lightest model (Haiku). Web search only.
   Writes `sightings/YYYY-MM-DD.json` on `headline-data`.
2. **Shortlist.** `tasks/shortlist.md`, Mondays, Sonnet. Reads the last 7 sightings files.
   Opens one issue "Headline candidates, week of ..." and writes `shortlists/YYYY-Www.md`.
3. **Research.** `tasks/research.md`, Tuesdays and Thursdays or Run now, Sonnet (Opus only on
   close calls). Takes one `research` issue, writes a check with `draft: true` on branch
   `check/<slug>`, runs `checks:verify`, opens a draft PR.
4. **Publish.** Jordan reviews the draft PR and its preview, flips `draft: false`, merges.

Jordan picks what gets researched by clicking a one-click "open research issue" link in the
Monday shortlist (it pre-fills the `research` label). The research routine takes at most one
issue per run and stops after two `check/` PRs in an ISO week.

Data lives on the orphan branch `headline-data` (see `data-branch/README.md`), which the site
never builds. Create it with `npm run checks:init-data-branch` (local only; add `-- --push` to
publish it). Validate data with `npm run checks:validate -- <path-to-headline-data>`.

## What the watcher watches

Subreddits, via web search restricted to reddit.com only (never Reddit's API, never scraping):
r/writing, r/selfpublish, r/books, r/publishing, r/ArtistHate, r/ArtistLounge, r/environment,
r/climate, r/energy, r/collapse, r/technology, r/Futurology, r/artificial, r/ChatGPT,
r/BetterOffline, r/antiai, r/FuckAI, r/news, r/science, r/Teachers.

Plus news searches on harm keywords (water, electricity bills, jobs, students, art and book
theft, copyright, mental health, emissions, "study finds" brain or cognition, AI bubble).
Only links to published stories are logged. No usernames, no quoted posts.

## "Taking off" signals

A claim is taking off when it is:

- seen **two days in a row** (same `claimId` in consecutive sightings files);
- seen in **two or more subreddits**;
- seen **jumping from an anti-AI subreddit** (r/ArtistHate, r/antiai, r/FuckAI, r/BetterOffline)
  **to a big general one** (r/news, r/science, r/technology, r/Futurology, r/ChatGPT).

The shortlist scores reach, engagement, momentum (these signals) and checkability, 1 to 5 each.

## Research checklist

1. **Pin the claim.** The headline exactly as published, outlet, date, link; the claim in one sentence.
2. **Read the original.** The study, report or survey itself, not coverage of it. Record its type.
3. **Gather context,** including evidence for the headline, not only against it.
4. **Second-opinion pass.** Reread the draft against the sources as a skeptic and fix what fails.
5. **Verdict from the scale,** rating the headline as written, not the study.

The question is always "what's the verdict?", never "debunk this".

## Verdict scale

Defined once in `src/lib/check-scale.mjs` and shown on `/checks/how-we-check/`:
Holds up, Mostly holds up, Mixed, Overblown, Doesn't hold up, Too early to tell, Out of date.

Source types: peer-reviewed study, preprint, company or industry report, survey, anecdote.

## Checks on every draft

`npm run checks:verify [-- file.mdx] [--offline]` (also run free in CI by `headline-checks.yml`
on PRs touching checks):

- frontmatter matches the schema and the verdict is on the scale;
- the required sections are present and in order: Where the claim came from, What the evidence
  actually shows, What the headline gets right, What it gets wrong or leaves out, Where the real
  concern is, What we're not sure about (The progressive move is optional);
- talking points present; sources present with one marked `original: true`;
- every source link loads (404, 5xx and network errors fail; 401/403/429 bot walls warn);
- stat-card numbers appear in a fetched source's text (best effort, warning only; PDFs and
  paywalled pages are not read).

## Drafts and publishing

`draft: true` checks render in `astro dev`, on Cloudflare preview builds of any branch other
than `main`, or with `SHOW_DRAFTS=1`. They never appear in a production build. Drafts show a
"Sample, not a published check" banner and carry `noindex`. To publish: set `draft: false`,
update `published`/`updated` and the changelog, merge.

## Open items before launch

- Confirm `newsletter@progressivesforai.com` is routed in Cloudflare Email Routing (used for
  "Send us a headline" and "report a mistake"; set in `src/lib/checks.ts`).
- The sample check (`checks/bottle-of-water.mdx`) is a template test, not a reviewed check.
