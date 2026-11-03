# Headline Checks pipeline

How a viral AI headline becomes a published check. Three scheduled Claude Code routines
(Anthropic cloud, on Jordan's Claude plan) do the finding and drafting against this repo.
Nothing runs on the Mac Mini. Jordan publishes.

## Cost warning: pull requests into main start paid reviews

`.github/workflows/ai-code-review.yml` (as of PR #31) runs on **every pull request into
`main`**, for the `opened`, `synchronize` (each new push to the PR branch) and `reopened`
events. There is no draft filter: a draft PR triggers it too. It has two jobs, billed to the
API keys in the repo secrets:

1. **OpenAI Logic Review: always runs.** One Responses API call to `gpt-5.3-codex` with the PR
   diff plus the full text of each changed file (capped at 350,000 characters, about 90K
   tokens). `.md` and `.mdx` files are not skipped. A one-file check is about 7 to 15 KB of
   MDX (the sample is 6.9 KB), sent twice (full file and diff), so roughly 4K to 8K input
   tokens plus the fixed review prompt.
2. **Anthropic Security Review (Sonnet 5.5): skipped when every changed file is
   `.md/.mdx/.txt`, an image or a PDF.** It still runs (a Claude Code session of up to 8
   minutes) if the PR touches anything else, such as `.ts`, `.astro`, `.mjs`, `.json` or a
   workflow file.

So a research PR that adds only `src/content/reality-check/checks/<slug>.mdx` costs **one
OpenAI review when opened, plus one more for every later push** to its branch. If the routine
also edits code or JSON, each push costs both reviews. The `concurrency` setting cancels an
in-progress run when a new push arrives, but a cancelled run may already have spent tokens.
The per-run dollar amount is not knowable from the repo (the workflow notes Sonnet 5.5 at
$2/$10 per million tokens; `gpt-5.3-codex` pricing is not recorded there): read both usage
pages after the first research PR.

The research routine is told to edit only the new `.mdx` file and to push once, so the
expected cost is one OpenAI review per research PR, at most two research PRs a week.

Two more paid workflows exist for sources, both **off** until a repo variable turns them on
(see "Source checks" below): the ChatGPT source check on `check/*` branch pushes (about 2 to 5
cents per check) and the monthly Jev re-check (a few cents a month, plus one OpenAI review when its
date branch is merged).

What costs nothing: pushes to `headline-data`, pushes to `check/*` branches with no PR open
(apart from the ChatGPT source check's few cents), the
`headline-checks.yml` and `validate-data.yml` workflows (free on a public repo), and the
Cloudflare Pages preview build every branch push gets.

To make content-only PRs free (not done; `ai-code-review.yml` is untouched): give the OpenAI
job the same "docs/images only" skip step the security job has. Not `paths-ignore`: as the
workflow notes, a required check that never starts blocks the merge.

## The three plug-in points

Runner: three Claude Code routines on Jordan's Claude plan. Prompts are in `tasks/`.
None of them is scheduled yet.

1. **Find candidates.** `tasks/watcher.md`, daily, lightest model (Haiku). Web search only.
   Writes `sightings/YYYY-MM-DD.json` on `headline-data`.
2. **Shortlist.** `tasks/shortlist.md`, Mondays, Sonnet. Reads the last 7 sightings files.
   Opens one issue "Headline candidates, week of ..." and writes `shortlists/YYYY-Www.md`.
3. **Research.** `tasks/research.md`, Tuesdays and Thursdays or Run now, Sonnet (Opus only on
   close calls). Takes one `research` issue, writes a check with `draft: true` on branch
   `check/<slug>`, pushes it, waits for the ChatGPT source check to commit its results, pulls
   them, runs `checks:verify`, then opens a draft PR.
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
   Every source gets a short exact quote and the one claim it backs, then a Claude Haiku check.
3. **Gather context,** including evidence for the headline, not only against it.
4. **Second-opinion pass.** Reread the draft against the sources as a skeptic and fix what fails.
5. **Verdict from the scale,** rating the headline as written, not the study.

The question is always "what's the verdict?", never "debunk this".

## Source checks

Sources are a main part of every check page: a "Check our sources" section sits right after
the evidence, one card per source (outlet, title, date, type, the claim it backs, a short exact
quote, an "Open source" button and its check results). The original source is card 1. Inline
citations (`<sup><a href="#source-N">N</a></sup>`) jump to and highlight the card.

Data lives in the check's frontmatter, `sources:` (schema: `sourceSchema` in
`src/lib/check-scale.mjs`): `url, title, outlet, date, type, isOriginal, supportsClaim, quote`
and `verification: { haiku, chatgpt, recheck }`.

**Every source is checked twice before publishing**, by two different AI models reading the
page on their own:

1. **Claude Haiku**, in the research routine (`tasks/research.md` step 6): one Haiku subagent
   per source fetches the page and writes `verification.haiku`. Runs on Jordan's Claude plan.
2. **ChatGPT**, in `.github/workflows/source-check-chatgpt.yml` (Jordan's ChatGPT subscription
   can't be called from automation, so this uses the `OPENAI_API_KEY` repo secret). It runs on
   **pushes to `check/**` branches, before a PR exists**. Code fetches each page and sends the
   part around the quote (12,000 characters, about 3,000 tokens) to `gpt-5.4-mini` with a
   300-token answer cap and at most 12 sources per run. It commits `verification.chatgpt` to the
   branch ("Source check: ChatGPT results") and writes a summary to the run page. Only new or
   edited sources are sent. PDFs are read too (text extracted in code); scanned PDFs with no
   text and paywalled pages are reported "check by hand".
   **Off unless the repo variable `SOURCE_CHECK_CHATGPT` is `on`.**

   **It never commits onto a branch with an open PR.** A bot commit on an open PR starts new
   runs that GitHub holds as "action required" and, once approved, another paid AI code review
   (this happened on PR #32). So the push job skips any branch that already has an open PR, and
   ignores its own results commit. On a pull request the workflow only verifies: every changed
   check must have a ChatGPT result for each source's current url, quote and claim
   (`npm run checks:chatgpt -- <file> --verify-only`). No API call, no commit.

   To re-check a source after the PR is open (you changed its url, quote or claim): close the
   PR, push the branch, wait for the results commit, then reopen the PR. Reopening starts one
   paid review, the same as any push to an open PR.

   The writer edits only the `verification` lines that changed, one line each, so the rest of
   the frontmatter keeps its quoting and comments.

Each result stores a fingerprint (`for`) of the url, quote and claim it checked; editing any of
them makes the result stale. The ChatGPT workflow stamps its own; the research routine stamps
Haiku's with `npm run checks:fingerprint -- <file> --stamp haiku`.

Publishing rule (schema, so `checks:validate`, `checks:verify` and the build all enforce it): a
check with `draft: false` needs a `haiku` and a `chatgpt` result on every source, each
`supports` or `partly` and stamped with the current fingerprint. `doesnt-support`, a missing or
stale fingerprint, or `sample: true` blocks it. Drafts only warn.

**Cost of the ChatGPT check** (`gpt-5.4-mini` list price $0.75 per million input tokens and
$4.50 per million output, checked 2026-11-03): about 3,300 input and up to 300 output tokens per
source, so **about $0.003 to $0.004 a source, $0.02 to $0.025 for a typical 6-source check, at
most about $0.05 a run** (12-source cap). At two checks a week, well under $0.25 a month.
Re-pushes cost nothing for sources that didn't change.

### Monthly re-check through Jev

`.github/workflows/source-recheck-monthly.yml` runs on the 1st of each month (and by hand).
For every published check it fetches each source in code (HTTP status, final URL, page text)
(PDFs included) and asks Jev (TypeSafe.AI, `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`,
Bearer key) two yes/no questions: does the page still say the quote, and does it still support
the claim. Jev reads only about 6,000 characters: the passage around the quote, or the
passages sharing the most words with it (Jev gets worse with large irrelevant text).

**"Still says this" needs code, not just the model.** A source is written as "ok" only when
code finds the quote on the page word for word (ignoring case, curly quotes and spacing) and
Jev's "supports the claim" answer is 0.7 or higher. Jev can be swayed by text written for it,
so a model's yes alone never changes the page. If the quote is missing, the source goes to the
issue as "Quote not found" with Jev's read, for a person to judge (pages that reword a quote
land here).

**Nothing negative reaches the live site without Jordan.** The job writes only "ok" results
(above) and only refreshes their "Last re-checked" date. PDFs get the same check: code
extracts their text (`unpdf`, a pinned devDependency) and looks for the quote, then Jev reads
it. Only a PDF with no text layer (a scan, or an image) goes to the issue as "link still loads,
needs a person", along with other files that aren't web pages. Everything else goes only into one issue, **"Sources need
attention, <Month YYYY>"**, with the HTTP status and Jev's confidence: links that are down,
pages that may no longer say it (under 0.4), quotes not found, low-confidence results (0.4 to
0.7), scanned PDFs, and bot walls or paywalls it couldn't read. Thresholds compare the raw score; the
issue shows it rounded. The issue suggests "find a new source" when a source fails again after a month
with no good re-check. The page shows a warning badge ("Link down", "No longer says this",
"Needs a new source") only after a person sets `verification.recheck.status` in the check file,
and the job never overwrites a status a person set.

The "ok" dates go to branch `source-recheck/YYYY-MM`, not `main`: `main` requires the two
status checks (with admins included), so a workflow can't push to it. The issue ("Sources need
attention" or, if nothing failed, "Source re-check dates ready") links a one-click pull request.
Merging it starts one OpenAI Logic Review (the files are `.mdx`, so the security review skips).
Leaving it unmerged is harmless: the page keeps showing the previous re-check date.

**Off unless the repo variable `SOURCE_RECHECK_JEV` is `on`**, and it needs the
`TYPESAFE_API_KEY` repo secret; without the secret it notes that and exits cleanly. A manual
run can tick "dry run": fixtures from `tests/checks/fixtures/recheck/`, no network, nothing
written. Locally: `npm run checks:recheck -- --dry-run`.

**Cost of the re-check:** Jev bills input only, $0.042 per million tokens. Each source sends
about 2,000 tokens, so about **$0.0001 a source, under 1 cent a month for 50 sources**. Plus the
one OpenAI review if the date branch is merged.

**The thresholds (0.4 and 0.7) are starting points, not calibrated.** Jordan's Jev plan sets
thresholds from a labeled sample of real data, and when Jev is wrong, fixes the question
wording first. Once the key is in: run `npm run checks:recheck` (no `--write`) on the published
checks, compare each answer with what the page actually says, and adjust `OK_AT` /
`CHANGED_BELOW` or the question text in `scripts/checks/recheck-sources.mjs`. Cost: a fraction
of a cent.

### Turning the source checks on

1. Add the repo secret `TYPESAFE_API_KEY` (`OPENAI_API_KEY` already exists).
2. Set the repo variables `SOURCE_CHECK_CHATGPT` = `on` and `SOURCE_RECHECK_JEV` = `on`.

## Verdict scale

Defined once in `src/lib/check-scale.mjs` and shown on `/checks/how-we-check/`:
Holds up, Mostly holds up, Mixed, Overblown, Doesn't hold up, Too early to tell, Out of date.

Source types: peer-reviewed study, preprint, company or industry report, survey, government
data, news report, nonprofit report, anecdote.

## Checks on every draft

`npm run checks:verify [-- file.mdx] [--offline]` (also run free in CI by `headline-checks.yml`
on PRs touching checks):

- frontmatter matches the schema and the verdict is on the scale;
- the required sections are present and in order: Where the claim came from, What the evidence
  actually shows, What the headline gets right, What it gets wrong or leaves out, Where the real
  concern is, What we're not sure about (The progressive move is optional);
- talking points present; sources in the frontmatter with the original first, and (for
  `draft: false`) both model checks passing on every source;
- the `<CheckSources>` section sits right after "What the evidence actually shows", and every
  inline citation number points at a source;
- every source link loads (404, 5xx and network errors fail; 401/403/429 bot walls warn), and
  each source's quote is on its page (warning only);
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
