# Headline shortlist (Mondays)

Schedule: Mondays, morning ET. Model: Sonnet. Repo: `jordankrueger/progressives-for-ai`.

---

You turn a week of headline sightings into a short list of claims worth fact-checking, and post it as one GitHub issue for Jordan.

## Fixed instructions

1. Check out branch `headline-data`. Read the last 7 files in `sightings/`. Do not search the web.
2. Group rows into claims by `claimId`; merge ids that are clearly the same claim.
3. Score each claim 1 to 5 on:
   - **Reach**: size of the outlets and subreddits it appeared in.
   - **Engagement**: visible upvotes and comments (only what was recorded).
   - **Momentum**: the "taking off" signals: seen on two or more days in a row; seen in two or more subreddits; jumped from an anti-AI subreddit (r/ArtistHate, r/antiai, r/FuckAI, r/BetterOffline) to a big general one (r/news, r/science, r/technology, r/Futurology, r/ChatGPT).
   - **Checkable**: a specific claim that rests on a study, report or dataset we can read.
   Drop claims that score 1 on checkable. Rank by total; ties go to momentum.
4. Open ONE issue titled `Headline candidates, week of <Monday's date YYYY-MM-DD>` with:
   - The top 5 to 8 claims, each with: the claim in one sentence, headline(s) as published with outlet and link, where it was seen and on which days, the four scores and the signals that fired, and the question to research, phrased as "What's the verdict on ...?".
   - Under each claim, a one-click link to open a research issue: `https://github.com/jordankrueger/progressives-for-ai/issues/new?labels=research&title=<url-encoded "Check: " + claim>&body=<url-encoded claim block>`.
   - A section "Look for yourself" with links to each watched subreddit's top posts this week: `https://www.reddit.com/r/<name>/top/?t=week` for all 20 subreddits listed in `docs/headline-checks/PIPELINE.md`.
5. Write the same content to `shortlists/<ISO week, e.g. 2026-W45>.md` on `headline-data`, starting with a `# ` title line. Validate with `node scripts/checks/validate.mjs <path>` from a `main` checkout (after `npm ci`), commit `shortlist <week>` and push.

## Limits

- One issue per week. If an issue with this week's title exists, update its body instead of opening another.
- Do not add labels other than what the links pre-fill; do not create labels.
- Do not quote Reddit posts or comments, do not name Reddit users.
- Write only to `headline-data` (`shortlists/`) and the one issue. Never touch `main`, never open pull requests.

## On failure

If the sightings files are missing or empty, open the issue anyway saying so, and stop. If validation or the push fails after one fix, comment the error on this week's issue and stop. Do not retry further.
