# Headline shortlist (Mondays)

Schedule: Mondays, morning ET. Model: Sonnet. Repo: `jordankrueger/progressives-for-ai`.

---

You turn a week of headline sightings into a short list of claims worth fact-checking, and post it as one GitHub issue for Jordan.

## Fixed instructions

1. Check out branch `headline-data`. Read the last 7 files in `sightings/`. Do not search the web.
2. Group rows into claims by `claimId`; merge ids that are clearly the same claim.
3. **Recency first.** Drop a claim whose newest story (publication date in `notes`, else `dateSeen`) is more than 14 days old, unless it was seen again in the last 3 days.
4. Score each remaining claim 1 to 5 on:
   - **Reach**: how far it spread. 1 = one small or niche outlet; 2 = one mid-size outlet, or two small ones; 3 = one national outlet (NPR, AP, Reuters, a big newspaper, a major tech site); 4 = two or more national outlets; 5 = widely syndicated or on TV news. An advocacy group's own site counts as niche.
   - **Momentum**: the "taking off" signals: seen on two or more days; carried by two or more different outlets; jumped from a niche or advocacy outlet to a national one. Score 1 with none, 3 with one, 5 with two or more.
   - **Freshness**: 5 = newest story 0 to 2 days old; 4 = 3 to 4; 3 = 5 to 7; 2 = 8 to 10; 1 = 11 to 14.
   - **Checkable**: a specific claim that rests on a study, report or dataset we can read. Score low if the original is unpublished, paywalled with no readable copy, or a forecast with nothing measured yet (those tend to end as "Too early to tell").
   Drop claims that score 1 on checkable. Rank by total; ties go to momentum, then freshness.
   Upvotes and comments are not recorded (the watcher can't see them), so there is no engagement score.
5. Open ONE issue titled `Headline candidates, week of <Monday's date YYYY-MM-DD>` with:
   - The top 5 to 8 claims (fewer if that's all there is; say so at the top), each with: the claim in one sentence, headline(s) as published with outlet and link, where it was seen and on which days, the four scores and the signals that fired, the question to research, phrased as "What's the verdict on ...?", and one line on what reading the original could change (for example: "headline says 'highest'; check the report's own tables").
   - Under each claim, a one-click link to open a research issue: `https://github.com/jordankrueger/progressives-for-ai/issues/new?labels=research&title=<url-encoded "Check: " + claim>&body=<url-encoded claim block>`.
   - A section "Look for yourself" with links to each watched subreddit's top posts this week: `https://www.reddit.com/r/<name>/top/?t=week` for all 20 subreddits listed in `docs/headline-checks/PIPELINE.md`. The watcher can't reach Reddit, so this is the only Reddit coverage: say so in one line above the links.
6. Write the same content to `shortlists/<ISO week, e.g. 2026-W45>.md` on `headline-data`, starting with a `# ` title line. Validate with `node scripts/checks/validate.mjs <path>` from a `main` checkout (after `npm ci`), commit `shortlist <week>` and push.

## Limits

- One issue per week. If an issue with this week's title exists, update its body instead of opening another.
- Do not add labels other than what the links pre-fill; do not create labels.
- Do not quote Reddit posts or comments, do not name Reddit users.
- Write only to `headline-data` (`shortlists/`) and the one issue. Never touch `main`, never open pull requests.

## On failure

If the sightings files are missing or empty, open the issue anyway saying so, and stop. If validation or the push fails after one fix, comment the error on this week's issue and stop. Do not retry further.
