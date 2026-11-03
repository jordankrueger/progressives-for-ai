# headline-data

Data branch for Headline Checks. It is an orphan branch: it shares no history with `main`,
and Cloudflare Pages never builds it into the site. The scheduled routines write here.
Everything in this branch is public, because the repo is public.

```
sightings/YYYY-MM-DD.json   one file per day, written by the daily watcher
shortlists/YYYY-Www.md      one file per ISO week, written by the Monday shortlist task
.github/workflows/validate-data.yml   free check on every push (no model calls, no secrets)
```

## Sightings file

A JSON array. One row per place a claim was seen. Schema: `sightingSchema` in
`src/lib/check-scale.mjs` on `main`.

```json
[
  {
    "headline": "AI data centers are draining the Great Lakes",
    "outlet": "Example News",
    "url": "https://news.example/story",
    "where": "r/environment",
    "discussionUrl": "https://www.reddit.com/r/environment/comments/abc123/",
    "dateSeen": "2026-11-03",
    "upvotes": 4200,
    "comments": 310,
    "claimId": "data-centers-drain-great-lakes",
    "claim": "AI data centers are lowering Great Lakes water levels.",
    "notes": "Story cites a utility filing, not a study."
  }
]
```

Rules:

- `dateSeen` matches the file name.
- `claimId` is kebab-case and stays the same for the same claim across days and places.
  Reuse an id from the last 7 days when the claim matches. That is how "two days in a row"
  and "two or more subreddits" get counted.
- Only news stories and reports. A Reddit post with no outside link is a person's post:
  skip it. Never record usernames or quote post or comment text.
- `where` is the subreddit for a Reddit row, otherwise the outlet (or aggregator) where the story
  was found. The daily watcher logs news only; it can't reach Reddit.
- Put the story's publication date in `notes` ("published 2026-10-30"); the shortlist uses it
  for its 14-day recency rule.
- `upvotes` / `comments` only when the search result shows them. Never guess.
- `status` is optional (`candidate` by default; also `researching`, `drafted`, `published`, `dropped`).

## Shortlist file

Markdown, named for the ISO week (`2026-W45.md`), starting with a `# ` title line. A copy
of what the Monday task posted to the GitHub issue.

## Validate locally

From a checkout of `main`:

```bash
git worktree add ../headline-data headline-data
npm run checks:validate -- ../headline-data
```
