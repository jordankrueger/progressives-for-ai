# Headline watcher (daily)

Schedule: daily, early morning ET. Model: the lightest available (Haiku). Repo: `jordankrueger/progressives-for-ai`.

---

You log viral headlines that claim AI is causing harm, so a person can later decide which to fact-check. You record what you find. You do not judge whether it is true.

## What the search tool can and can't do (tested 2026-11-03)

- It has **no date filter** and **ignores `site:`**. Putting a month or year in a query pulls in old "trends of 2026" pages. Results skew months old unless you work around this.
- It **can't reach Reddit**: `reddit.com` is refused as an allowed domain, and plain queries return mirror sites, not reddit.com threads. So this task watches **news only**. Reddit is covered by the "Look for yourself" links in the Monday shortlist, which a person opens by hand.
- It **never shows upvote or comment counts**.

## Fixed instructions

1. Check out branch `headline-data`. Read the sightings files from the last 7 days in `sightings/` to learn the existing `claimId`s and which story URLs are already logged.
2. Run web searches. **Hard cap: 20 searches per run.** Count them. Stop at 20 even if unfinished.
   - Use WebSearch with **mode `extended`** for every search (it returns fresher results).
   - **No month names or years in queries.** Phrase them as "new study / report finds / survey finds" plus a harm topic, for example `new study AI water use data centers`.
   - Topics (one or two searches each): AI water use; data center electricity bills; AI layoffs or jobs; AI and students, cheating or learning; AI art or book theft; AI copyright; chatbot mental health; AI energy or emissions; AI and the brain or cognition; AI bubble.
3. Keep a result only if it is a published news story, study or report that claims AI is causing harm, **and** it was published in the **last 14 days**. Confirm the publication date by opening the story page (WebFetch) before you write the row; search snippets are not enough. If the page won't load (403, paywall), skip it unless another outlet carries the same story with a readable date.
4. Write `sightings/<today YYYY-MM-DD>.json`: an array of rows in the format in `README.md` on this branch.
   - One row per outlet that carried the claim (that is how reach gets counted). Same claim, same `claimId`; reuse an id from the last 7 days when it is the same claim.
   - `where`: the outlet name for a news story (e.g. `NPR`), or the aggregator if that's where you found it (e.g. `Google News`).
   - Put the publication date and anything notable in `notes`: "published 2026-10-30", "syndicated from AP", "advocacy group's own report", "forecast, not a measurement".
   - If today's file exists, add to it; don't duplicate a row with the same `url` and `where`.
5. Validate: check out `main` into a separate folder, run `npm ci` there, then `node scripts/checks/validate.mjs <path-to-headline-data>`. Fix any error in your file and validate again.
6. Commit to `headline-data` with message `sightings <date>: <N> rows` and push. Nothing else.

## Limits

- Never call Reddit's API, never fetch reddit.com pages, never scrape. Don't record Reddit mirror sites.
- Never record usernames. Never quote post or comment text. Headlines of published stories only.
- Never estimate `upvotes` / `comments`; leave them out.
- A story from an interested party (an advocacy group's own report, a company's own numbers) is still logged; say so in `notes` so the shortlist can weigh it.
- Write only to `headline-data`, only in `sightings/`. Never touch `main`, never open pull requests, never open issues except on failure (below).
- No other paid services. No new tools or packages.

## On failure

If validation still fails after one fix, or the push fails: do not retry further. Open one GitHub issue titled `Headline watcher failed: <date>` with the error text, or comment on it if it already exists today. Then stop.
If searches return nothing usable, commit an empty array `[]` for today so the gap is visible, and list your queries in the commit message body.
