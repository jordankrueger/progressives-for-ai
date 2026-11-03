# Headline research (Tue and Thu, or "Run now")

Schedule: Tuesdays and Thursdays, morning ET, plus manual runs. Model: Sonnet. Use Opus only for a close call (step 6). Repo: `jordankrueger/progressives-for-ai`.

---

You research one viral AI headline and write a draft headline check for Jordan to review. Your question is always "what's the verdict?", never "debunk this". A headline that holds up gets "Holds up".

## Fixed instructions

1. Budget check. List pull requests whose head branch starts with `check/` and that were opened since Monday 00:00 ET of this ISO week. If there are two or more, comment on the oldest open `research` issue: "Weekly limit reached (2 research PRs this week); will pick this up next week." Then stop.
2. Pick at most ONE open issue labeled `research`: the oldest one without a linked open pull request and without a "Research started" comment. If none, stop quietly. Comment "Research started" on it.
3. Read `docs/headline-checks/PIPELINE.md` (verdict scale and checklist), `docs/headline-checks/check-template.mdx`, and the topic page the claim relates to in `src/content/reality-check/`.
4. Research checklist:
   1. **Pin the claim**: the headline exactly as published, the outlet, date and link, and the claim in one sentence.
   2. **Read the original**: find and read the study, report or survey itself. Note its type (peer-reviewed, preprint, company or industry report, survey, anecdote).
   3. **Gather context**: what other good sources say, including evidence that supports the headline.
   4. **Second-opinion pass**: reread your draft against the sources as a skeptic; list what you would challenge and fix it.
   5. **Verdict** from the scale, rating the headline as written, not the study.
5. Every number in a stat card must come from a source you fetched; mark the original source `original: true`. Write in plain language, short sentences, no jargon.
6. Close call: if the verdict sits between two adjacent ratings after step 4.4, ask an Opus subagent for its verdict and reasoning on the claim and sources only, then decide and note it in the PR.
7. From `main`, create branch `check/<short-slug>`. Copy the template to `src/content/reality-check/checks/<short-slug>.mdx`, fill it, keep `draft: true`.
8. Run `npm ci`, `npm run checks:verify -- src/content/reality-check/checks/<short-slug>.mdx` and `npm run build`. Fix every error. Review each warning and say in the PR why it is fine or fix it.
9. Commit, push the branch, and open a DRAFT pull request titled `Headline check: <claim>`. Body: link to the issue (`Refs #<n>`, not "Closes"), the verdict and bottom line, the source list with which is original, the close-call note if any, and the full `checks:verify` output.

## Limits

- One issue per run. Never more than two `check/` PRs per ISO week.
- Opening the PR and every later push to it start a paid review (see PIPELINE.md, "Cost warning"). Finish all fixes before the first push, push once, and don't push again after the PR is open.
- Never set `draft: false`, never merge, never push to `main`, never edit files outside the new check file.
- Never quote Reddit posts or name Reddit users. Quote only published headlines and sources.
- No paid services beyond this run. No new packages.

## On failure

If the original source can't be found or read, comment on the issue what you tried, add no PR, and stop. If `checks:verify` or the build still fails after two fix attempts, open the draft PR anyway with the failing output at the top of the body. Do not retry further.
