# PfAI Reality Check — Implementation Plan

> **For agentic workers (Codex):** Execute one SLICE per `codex exec` session. Each slice ends at a verification checkpoint. Do NOT proceed past your slice's stop condition. You run inside a git worktree and **cannot commit** (`.git` metadata is outside the sandbox write boundary) — make the file changes, run the slice's verification commands, report results + any deviations, and STOP. Claude reviews the diff and commits. Steps use `- [ ]` checkboxes.

**Goal:** Add the "Reality Check" content section to progressivesforai.com — a deep, heavily-sourced, mineable counter-narrative hub — by migrating the site to Astro and shipping water + energy pages.

**Architecture:** Migrate the hand-built static `index.html` to Astro (`output: 'static'`, Cloudflare Pages), mirroring jordankrueger.com. Reality Check entries are MDX files in an Astro content collection rendered by a shared template, with copy-with-attribution and share components. The existing `functions/` Pages proxies and signup `worker.js` are left untouched.

**Tech Stack:** Astro, @astrojs/mdx, @astrojs/sitemap, Cloudflare Pages, Playwright (verification), vanilla CSS (extracted from current site).

**Spec:** `docs/superpowers/specs/2026-06-13-pfai-reality-check-design.md` (copied into repo at slice setup).

**Repo:** `jordankrueger/progressives-for-ai` (protected). Worktree → PR → self-merge. Sequential branches: `astro-reality-check-scaffold` (PR1) → `reality-check-water` (PR2) → `reality-check-energy` (PR3), each merged before the next.

---

## Slice map

| Slice | PR | Owner | Stop condition |
|---|---|---|---|
| 1 — Astro scaffold + homepage migration | PR1 | Codex | `npm run build` green; homepage visual parity vs live confirmed |
| 2 — Reality Check infra (collection, components, hub, template) | PR1 | Codex | build green with zero published entries; `functions/` proxies still serve under `wrangler pages dev`; copy button works on a draft fixture |
| **PR1 gate** | PR1 | Claude | local `wrangler pages dev` + direct-upload preview deploy confirm Pages Functions coexist with the Astro build; merge PR1 |
| 3 — Water page + public launch | PR2 | Codex | water page builds & renders; copy/share work; citations resolve; nav link on; every claim traces to a verified source |
| 4 — Energy research pass | PR3 | Claude | `research-notes.md` for energy with VERIFIED sources (via `/research`) |
| 5 — Energy page | PR3 | Codex | energy page builds & renders; same checks as water |

---

## SLICE 1 — Astro scaffold + homepage migration (PR1)

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore` (add `dist/`, `node_modules/`, `.astro/`)
- Create: `src/pages/index.astro`, `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/NewsletterSignup.astro`, `src/styles/global.css`
- Create: `public/` and move static assets into it (`Progressives for AI Logo.png`, `apple-touch-icon.png`, `progressives-for-ai-sharing.png`)
- Keep untouched: `functions/`, `worker.js`, `wrangler.toml`, `embed-*.html`, `.github/`
- Reference (read-only): current `index.html`

- [ ] **Step 1: Initialize package.json + deps**

Create `package.json`:
```json
{
  "name": "progressives-for-ai-site",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/mdx": "^4.0.0",
    "@astrojs/sitemap": "^3.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```
Run `npm install`. (Pin to whatever current major Astro resolves to; if 5.x is not current, install latest stable and record the version.)

- [ ] **Step 2: astro.config.mjs** — mirror jordankrueger.com

```js
// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://progressivesforai.com',
  output: 'static',
  integrations: [mdx(), sitemap()],
  vite: { server: { allowedHosts: ['jordans-mac-mini'] } },
});
```

- [ ] **Step 3: Extract CSS** — copy the entire contents between `<style>` and `</style>` (index.html lines 24–460) verbatim into `src/styles/global.css`. Do not restyle. Preserve every rule and media query.

- [ ] **Step 4: Base.astro layout** — `<head>` (title, meta description, viewport, Inter font links, OG tags, apple-touch-icon, favicon), imports `../styles/global.css`, renders `<Header />`, a `<slot />`, `<Footer />`. Pull the exact `<head>` contents from current `index.html` head (lines 3–23) so meta/OG parity holds. Accept props `title`, `description`, `ogImage`.

- [ ] **Step 5: Header.astro / Footer.astro / NewsletterSignup.astro** — move the `<header>`/`<nav>` markup (index.html ~464–476) into Header.astro; the footer/CTA markup into Footer.astro; the signup form markup + the inline `<script>` (index.html 607–end, `WORKER_URL` fetch logic) into NewsletterSignup.astro. **Preserve form ids (`heroForm`/`footerForm`), the worker URL, and the fetch logic byte-for-byte** so signup keeps working. NewsletterSignup accepts a `formId` prop.

- [ ] **Step 6: index.astro** — compose Base + the page sections (hero, why-matters, ai-101, concerns, cta) from index.html lines 477–605, using `<NewsletterSignup formId="heroForm" />` and `formId="footerForm"` where the two forms were. Header nav: keep current items only (do NOT add Reality Check yet).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exits 0; `dist/index.html` exists and contains the hero headline text and both signup form ids.

- [ ] **Step 8: Visual parity check (Playwright screenshot)**

Create `tests/parity.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
// Serves dist/ on :4321 via `npm run preview` (started by Claude before running)
test('homepage renders hero + both signup forms', async ({ page }) => {
  await page.goto('http://localhost:4321/');
  await expect(page.locator('text=Progressives for AI').first()).toBeVisible();
  await expect(page.locator('#heroForm')).toBeVisible();
  await expect(page.locator('#footerForm')).toBeVisible();
  await page.screenshot({ path: 'tests/__shots__/home-astro.png', fullPage: true });
});
```
Run: `npx playwright test tests/parity.spec.ts` (after `npm run preview &`).
Expected: PASS; screenshot written.

- [ ] **Step 9: STOP & report.** Report: Astro version installed, build output, Playwright result, and the path to `home-astro.png`. Note any section that did not map cleanly. Do not touch Reality Check yet. Do not commit.

**Claude review (Slice 1):** diff for scope (only the files above), confirm CSS extracted verbatim (`diff` the style block), confirm signup script/worker URL unchanged, eyeball `home-astro.png` against the live site, run `npm run build`. Commit on `astro-reality-check-scaffold`.

---

## SLICE 2 — Reality Check infrastructure (PR1)

**Files:**
- Create: `src/content.config.ts`
- Create: `src/components/CopyButton.astro`, `Stat.astro`, `TalkingPoints.astro`, `SharePack.astro`, `Sources.astro`
- Create: `src/layouts/RealityCheck.astro`
- Create: `src/pages/reality-check/index.astro` (hub), `src/pages/reality-check/[slug].astro` (entry renderer)
- Create: `src/content/reality-check/_fixture.mdx` (draft fixture for testing; `draft: true`)
- Create: `tests/reality-check.spec.ts`

- [ ] **Step 1: content.config.ts** — define the `reality-check` collection (glob `src/content/reality-check/*.mdx`) with the Zod schema from spec §4 (`title`, `dek`, `category` enum `myth|guide|tracker`, `topic`, `published` date, `updated` date, `changelog` array of `{date,note}`, optional `readingTime`, `ogImage`, `draft` boolean default false).

- [ ] **Step 2: CopyButton.astro** — renders a `<button class="copy" data-copy={text}>Copy</button>` and a single shared client script (define once) that on click writes `data-copy` to clipboard, shows "Copied ✓" + a toast, reverts after ~1.4s. Hidden when JS unavailable (button starts `hidden`, script unhides). Prop: `text`.

- [ ] **Step 3: Stat / TalkingPoints / SharePack / Sources** — implement per spec §4 using the v2 mockup markup/classes as the visual contract (see `mockups/reality-check-anatomy-v2.html` in the project dir — Claude will paste the relevant CSS into `global.css`). Each `<Stat>` and each talking `<Point>` embeds a `<CopyButton text={...with source appended...} />`. `<TalkingPoints>` adds a "Copy all" button. `<SharePack>` renders a copyable blurb + Copy-link / Bluesky-intent / mailto buttons. `<Sources>` renders a numbered list with verified-date stamps and `id` anchors for `<sup>` citations.

- [ ] **Step 4: RealityCheck.astro layout** — extends Base; renders badge (category·topic), H1 title, meta row (updated date, reading time, source count), dek/verdict, `<slot />` for the MDX body, then changelog from frontmatter, then `<SharePack>` + newsletter CTA. Adds JSON-LD Article schema + per-page OG from frontmatter.

- [ ] **Step 5: [slug].astro** — `getStaticPaths()` over the collection **excluding `draft: true`** entries; renders the entry's MDX `<Content />` inside `RealityCheck.astro`.

- [ ] **Step 6: hub index.astro** — lists non-draft entries grouped by `category` (Myths / Guides / Tracker headings; omit empty groups). Graceful empty state ("Reality Checks coming soon") when there are zero non-draft entries. This page exists but is NOT linked from the site nav yet.

- [ ] **Step 7: _fixture.mdx** — a `draft: true` fixture entry exercising every component (a `<Stat>`, a `<TalkingPoints>` with 2 points, a `<SharePack>`, a `<Sources>` with 2 sources, one `<sup>` citation). Used only for component testing; excluded from the build by the draft filter.

- [ ] **Step 8: Build with zero published entries**

Run: `npm run build`
Expected: exits 0. `dist/reality-check/index.html` exists (empty-state hub). No `dist/reality-check/_fixture/` is generated (draft excluded). Build does NOT error on the otherwise-empty collection.

- [ ] **Step 9: Functions coexistence (local) + component behavior**

Add to `tests/reality-check.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
// Run against `wrangler pages dev dist` on :8788 (started by Claude)
test('archive proxy still responds', async ({ request }) => {
  const r = await request.get('http://localhost:8788/archive.xml');
  expect(r.status()).toBeLessThan(500); // proxy reachable, not a build-broke 5xx
});
test('hub empty state renders', async ({ page }) => {
  await page.goto('http://localhost:8788/reality-check/');
  await expect(page.locator('text=Reality Check').first()).toBeVisible();
});
```
To exercise components, temporarily flip `_fixture.mdx` to `draft: false`, rebuild, and verify a copy button copies with attribution:
```ts
test('stat copy button copies text with source', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('http://localhost:8788/reality-check/fixture');
  await page.locator('.stat .copy').first().click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Source'); // attribution travels with the copy
});
```
Run the suite under `wrangler pages dev dist`. Then revert `_fixture.mdx` to `draft: true`.

- [ ] **Step 10: STOP & report.** Report build output, that draft was excluded, archive-proxy status code, hub empty-state result, and the copy-with-attribution test result. Note the temporary fixture flip was reverted. Do not link Reality Check in nav. Do not commit.

**Claude review (Slice 2):** diff for scope; confirm draft filter in `getStaticPaths`; confirm `_fixture.mdx` left at `draft: true`; verify the single-instance CopyButton script (no duplication per stat); run the suite myself under `wrangler pages dev`. Commit on `astro-reality-check-scaffold`.

---

## PR1 GATE (Claude) — the deployment-risk verification

The spec's highest risk: do the `functions/` Pages proxies still fire once an Astro build output is configured? Verify in TWO environments before merging PR1:

- [ ] **Local:** `npm run build && npx wrangler pages dev dist` → `curl -s -o /dev/null -w "%{http_code}" http://localhost:8788/archive.xml` and `.../archive/issue-18` → expect non-5xx (proxy executes). Confirm homepage + `/reality-check/` also serve.
- [ ] **Real preview deploy (no prod impact):** `npx wrangler pages deploy dist --project-name <pages-project> --branch rc-preview --commit-dirty=true` (direct upload; does NOT change the git-integration production build settings). Hit the returned `*.pages.dev` preview URL: homepage parity, `/reality-check/` empty state, and **`/archive.xml` + `/archive/issue-18` proxy** all work.
- [ ] If proxies break under build, switch to fallback: port the two `functions/*.ts` proxies to Astro endpoints (`src/pages/archive.xml.ts`, `src/pages/archive/[...path].ts`) and re-verify. Document the outcome.
- [ ] **Set the git-integration build settings** (CF Pages dashboard or via API): build command `npm run build`, output dir `dist`. Confirm Node version. (Only after the preview proves out.)
- [ ] Open PR1, let `ai-code-review.yml` run, self-review the full diff, merge, confirm production deploy renders unchanged for visitors. **Record the confirmed Pages-Functions-+-build config** in repo `README.md` and a Tech KB entry (spec §3 post-verification step).

---

## SLICE 3 — Water page + public launch (PR2)
Branch `reality-check-water` off updated `main`.

**Files:**
- Create: `src/content/reality-check/water.mdx`
- Modify: `src/components/Header.astro` (add Reality Check nav link), `src/components/Footer.astro` (add link)
- Reference (read-only, in project dir): `water-stats-cheatsheet.md`, `2026-05-11-data-center-water-claim/research-notes.md` (Claude will inline the verified facts + exact source list into the slice prompt, since these live outside the worktree)

- [ ] **Step 1: water.mdx** — frontmatter (`title: "Does AI really waste all our water?"`, `dek`, `category: myth`, `topic: Environment`, `published`, `updated`, `changelog`). Body follows the recommended flow (verdict → what you've heard → what's true with `<Stat>` cards → where the real concern is → the progressive move → `<TalkingPoints>` → `<Sources>`). **Use ONLY the verified figures and sources Claude provides in the prompt. Do not invent or add statistics.** Where the golf number differs by source (476B vs 531B), state the range and cite both.

- [ ] **Step 2: Turn on nav** — add `Reality Check` → `/reality-check/` to Header nav and Footer.

- [ ] **Step 3: Build + verify**

Run: `npm run build`
Expected: `dist/reality-check/water/index.html` exists; contains the golf-vs-datacenter stat and a `<sup>` citation linking to the sources list.

- [ ] **Step 4: e2e (Playwright under `wrangler pages dev dist`)** — extend the suite:
  - `/reality-check/` hub now lists the water entry under "Myths"
  - water page: a `<Stat>` copy button copies text containing "Source"
  - "Copy all" on TalkingPoints copies a multi-line string ending with the page URL
  - each `<sup>` anchor scrolls to a matching `id` in Sources
  - SharePack "Copy link" copies the canonical URL
  - nav shows the Reality Check link

- [ ] **Step 5: STOP & report.** Report build, all e2e results, and a list mapping every stat/claim on the page → its source. Do not commit.

**Claude review (Slice 3) — content-critical:**
- Read `water.mdx` line-by-line; cross-check EVERY number + attribution against `water-stats-cheatsheet.md` / `research-notes.md` / the Ars Technica source. Any claim not traceable to a verified source → cut or fix.
- Confirm the 476B/531B range is presented honestly.
- Run the full Playwright suite under `wrangler pages dev`; eyeball the rendered page at a preview URL.
- Run humanizer + writing-voice mentally/with skills on the prose (this is Jordan-voice public content).
- Commit, push, open PR2, AI review, self-review, merge, verify live: water page loads, copy buttons work, citations resolve, OG/sitemap correct, nav link live. **This is the public launch.**

---

## SLICE 4 — Energy research pass (Claude, PR3)

- [ ] Run `/research` on data-center / AI energy use for the counter-narrative page: grid load & data-center demand growth, renewable-procurement story, efficiency/PUE trends, where the real (local/grid) concern is. Output a VERIFIED `research-notes.md` (sources fetched + confirmed, dated, with confidence flags) in `2026-06-13-data-center-energy-claim/`. No page is written until this exists. Stop condition: research-notes.md with all load-bearing claims VERIFIED.

---

## SLICE 5 — Energy page (PR3)
Branch `reality-check-energy` off updated `main`.

**Files:** Create `src/content/reality-check/energy.mdx`.

- [ ] **Step 1: energy.mdx** — same structure/components as water. Use ONLY verified figures from Slice 4's research-notes (inlined into the prompt by Claude). Add to hub automatically via the collection.
- [ ] **Step 2: Build + e2e** — same checks as water (stat copy, talking points, citations, share, hub now lists 2 entries under Myths).
- [ ] **Step 3: STOP & report** with the stat→source map.

**Claude review (Slice 5):** same content-critical review as water; humanizer/voice; commit, PR3, AI review, self-review, merge, verify live.

---

## Testing plan (summary)

Per slice, three layers:
1. **Build assertion** — `npm run build` exits 0 and expected `dist/` files exist with expected content (grep).
2. **Functions coexistence** — `wrangler pages dev dist` + curl the `/archive.xml` and `/archive/*` proxies (the core deployment risk) — gated in PR1, re-checked after each merge.
3. **Behavioral e2e (Playwright)** — homepage parity screenshot; copy-with-attribution; "copy all"; citation anchors; share-link copy; nav presence. Clipboard tests require `context.grantPermissions(['clipboard-read','clipboard-write'])`.

**Content correctness (water + energy)** is verified by Claude, not automation: every stat/attribution traced to a verified source before merge; source-range disclosed where sources disagree; energy gated behind a `/research` VERIFIED notes file.

**Rollback per PR:** git revert the merge commit; Cloudflare Pages one-click rollback to the prior deployment. Signup worker + `functions/` proxies are never modified, so signup/archive/RSS survive any rollback.
