# PfAI "Reality Check" Section — Design Spec

**Date:** 2026-06-13
**Project:** Progressives for AI website (`progressivesforai.com`)
**Repo:** `jordankrueger/progressives-for-ai` (protected — worktree → PR → self-merge)
**Status:** Design approved by Jordan 2026-06-13; pending ChatGPT spec review + writing-plans.

---

## 1. Summary

Add **Reality Check**, an opinionated-but-evidence-forward content section to the PfAI site that pushes back on dominant AI media narratives progressives are absorbing uncritically (water use, energy use, job displacement, copyright, "AI is just hype"). Each entry is a deep, heavily-sourced, *mineable* reference page built so progressive organizers can grab a stat, a talking point, or (later) a graphic and paste it into their own arguments — with the citation attached.

This is the realization of the "Editorial Stance: Opinionated Pushback on Media Narratives" section captured in `GROWTH-PLAN.md` (2026-05-11) and tracked in Drift (task "Plan opinionated pushback section for PfAI site"; phase "First counter-narrative pages: water + power").

**Reality Check is the site's content hub.** Over time it absorbs the Phase 5 resource-style content (tools roundup, policy tracker, beginner guide) under internal categories — but at launch it holds only "Myth" entries.

## 2. Decisions (locked with Jordan)

| Question | Decision |
|---|---|
| Section name | **Reality Check** |
| Tone | **Evidence-forward** — facts carry the punch; progressive angle stated plainly, not woven as polemic. Maximally shareable across cautious orgs. |
| Page model | **Living pages + changelog** — one durable URL per topic, kept current, with a visible "Last updated" date and a "What changed" list. |
| Scope/architecture | **Reality Check is the content hub**; resource/tracker/guide pages fold in later under internal categories (Myths / Guides / Tracker). Launch with Myths only. |
| Build stack | **Astro + content collections**, `output: 'static'`, Cloudflare Pages — mirrors jordankrueger.com (the house standard). NOT 11ty. |
| Content authoring | **MDX** per entry: freeform prose body + drop-in components (`<Stat>`, `<TalkingPoints>`, `<SharePack>`, `<Sources>`). The 4-act flow is a recommended pattern, not an enforced skeleton. |
| Copy/share | **First-class feature.** Every stat and talking point has a one-click copy button that includes source attribution. Plus "copy all talking points" and a share pack (pre-written social blurb + link/Bluesky/email). |
| Graphics/memes | **v2 roadmap** — shown as a placeholder slot on the page; not built in v1. (Open: auto-generated per-page OG images may come earlier.) |
| Launch sequencing | **Build infra, hold content** — 3 PRs (below). Reality Check nav link stays OFF until the water page exists (no live empty hub, no soft launch). |

## 3. Architecture

Mirror jordankrueger.com's Astro structure.

```
src/
  pages/
    index.astro              # homepage, migrated from current hand-built index.html (VISUAL parity — see §3)
    reality-check/
      index.astro            # hub landing — entries grouped by category
      [slug].astro           # entry template; renders an MDX entry from the collection
  content/
    reality-check/
      water.mdx              # living page
      energy.mdx             # living page (PR 3)
  content.config.ts          # collection schema (see §4)
  layouts/
    Base.astro               # <head>, header nav, footer
    RealityCheck.astro       # entry chrome: badge, title, last-updated, body slot, sources, changelog, share pack
  components/
    Header.astro Footer.astro NewsletterSignup.astro
    Stat.astro TalkingPoints.astro SharePack.astro Sources.astro CopyButton.astro
  styles/
    global.css               # CSS extracted from the inline <style> in current index.html
astro.config.mjs             # output:'static', integrations:[mdx(), sitemap()]
package.json                 # astro, @astrojs/mdx, @astrojs/sitemap
functions/                   # EXISTING Cloudflare Pages Functions (archive + RSS proxy) — stays at repo root, untouched
worker.js, wrangler.toml     # EXISTING signup worker — untouched
```

**Build & deploy:** Cloudflare Pages build command `npm run build`, output dir `dist/`. Auto-deploy on push to `main` (already configured for the repo).

**Critical infra unknowns to VERIFY during implementation (do not assume):**
1. **Cloudflare Pages Functions + build output dir.** The repo currently relies on `functions/` (archive + RSS proxies) with a no-build deploy. Confirm — against current Cloudflare docs and a preview deploy — that `functions/` at the repo root still fires when a `dist/` build output is configured. jordankrueger.com uses a `workers/` dir, NOT Pages Functions, so this exact combination is unproven here. If it does NOT work, fallback options: (a) move proxy logic into Astro endpoints, or (b) keep `functions/` and confirm CF's documented precedence. This is the single highest-risk item.
2. **Exact CF Pages project settings** (build command, output dir, Node version) and where they're set (dashboard vs. `wrangler.toml`/`_routes`).
3. **Homepage parity** — migrated `index.astro` must render **visually identical** to today's `index.html` before cutover (verified by side-by-side screenshot diff, not literal byte-for-byte HTML — Astro will reflow markup/whitespace, which is fine).

**Post-verification documentation:** once PR 1 confirms the Cloudflare Pages Functions + Astro-build behavior, record the working configuration durably (Tech KB entry + this repo's README/CLAUDE notes) — it's the main deployment risk and the answer should not live only in a PR description.

**Rollback:**
- Snapshot the live homepage (HTML + screenshot) before PR 1.
- Every change is a revertable git commit.
- Cloudflare Pages retains prior deployments → one-click rollback in dashboard.
- The signup worker and `functions/` proxies are not modified, so newsletter signup + archive/RSS continue working independent of this work.

## 4. Content model (collection schema)

`content.config.ts` defines a `reality-check` collection. Frontmatter schema (Zod):

```ts
{
  title: string,                 // H1, phrased as a question ("Does AI really waste all our water?")
  dek: string,                   // verdict-forward subhead
  category: 'myth' | 'guide' | 'tracker',   // hub grouping; launch = 'myth' only
  topic: string,                 // e.g. "Environment" (badge secondary label)
  published: date,
  updated: date,                 // drives "Last updated"
  changelog: [{ date: string, note: string }],
  readingTime?: number,          // or computed
  ogImage?: string,              // defaults to existing branded sharing image
  draft?: boolean
}
```

Body = MDX prose with embedded components.

### Components

- **`<Stat big="476B vs 148B gallons/yr" source="CIT/USGA; EESI 2023">`** — renders the stat card; `copyText` prop (or derived) is what the copy button writes, with source appended.
- **`<TalkingPoints>`** with `<Point copy="...">` children — list with per-line copy + a "Copy all" that concatenates all points + a trailing source/URL line.
- **`<SharePack url="..." blurb="...">`** — pre-written social blurb (copyable) + Copy-link / Bluesky-intent / mailto buttons.
- **`<Sources>`** with `<Source>` children — numbered list with verified-date stamps; inline `<sup>` citation anchors link here.
- **`<CopyButton text="...">`** — shared primitive; uses `navigator.clipboard`, shows transient "Copied ✓" + toast. Progressive enhancement: if JS disabled, button is hidden and the raw text/stat is still fully readable.

All copy actions append source attribution so a paste carries its citation.

## 5. Page anatomy (entry template)

Recommended (not enforced) flow, matching the approved v2 mockup:

1. Category badge ("Myth · Environment") + H1 question
2. Meta row: Last updated · reading time · source count
3. **"The short version"** verdict box (paste-and-go summary)
4. **What you've heard** — popular framing, quoted
5. **What's actually true** — facts + `<Stat>` cards + inline citations; pull-quote for the strongest line
6. **Where the real concern is** — the honest local/regional caveat (credibility + shareability)
7. **The progressive move** — the angle, in the accent call-out
8. `<TalkingPoints>` — ready-to-paste one-liners
9. Graphics/memes roadmap slot (placeholder in v1)
10. `<Sources>` (numbered, verified dates)
11. **What changed** (changelog)
12. `<SharePack>` + newsletter CTA

Brand: existing PfAI tokens (green `#1e6b4f`, orange `#e85d04`, Inter). Reuse the existing signup form/worker for the CTA.

## 6. Navigation & SEO

- Header nav gains **Reality Check** (added in PR 2, when content exists); footer link too.
- URLs: `/reality-check/` (hub), `/reality-check/water`, `/reality-check/energy`.
- Hub page groups entries by `category` (only Myths populated at launch).
- Per-page `<title>`, meta description, Open Graph/Twitter tags from frontmatter.
- `@astrojs/sitemap` integration; JSON-LD **Article** schema per entry.
- OG image: v1 reuses existing branded sharing image; per-page graphics arrive with the v2 graphics roadmap.

## 7. The two launch pages

### Water — content ready
Source material already verified and on disk:
- `water-stats-cheatsheet.md` (verified 2026-04-27; updated 2026-06-13 with Ars Technica figures)
- `2026-05-11-data-center-water-claim/research-notes.md` (37KB) + saved source HTML snapshots
- **Anchor source:** Ars Technica, June 2026, "When it comes to total water use, AI data centers are a drop in the bucket" (verified 2026-06-13) — national-scale dismissal + honest local concern.

Key verified claims: golf ~476–531B gal/yr vs all data centers ~148–163B; Google DCs 2024 ~6.1B; Amazon 2025 ~2.5B; US total 2015 ~117 trillion; CA almonds ~1.3 trillion; lawns ~3.3 trillion. Local: Meta Newton County GA ~10% of county water (NYT); Potomac basin DCs 8%→29% by 2050; 40% of US DCs in high water-scarcity areas (Business Insider/WRI 2025). **Note the golf-number range (476B vs 531B) — cite both when precision matters.**

### Energy — needs research first
**No energy cheatsheet exists.** Writing energy claims from training data is disallowed (verify-first rule + the page's credibility depends on accuracy). Energy page requires a verified `research-notes.md` built via the `/research` pipeline BEFORE drafting: grid load & data-center demand growth, renewable-procurement story, efficiency/PUE trends, and where the real concern is. This is why energy is PR 3, after a research pass.

## 8. Delivery plan (3 PRs)

**PR 1 — Astro migration + scaffold (invisible to public).**
- Introduce Astro; convert homepage to `index.astro` with byte-parity; extract inline CSS to `global.css`.
- Set up `reality-check` collection + schema + components (`Stat`, `TalkingPoints`, `SharePack`, `Sources`, `CopyButton`) + hub `index.astro` + `[slug].astro` template.
- Verify the three infra unknowns (§3) on a CF preview deploy; confirm `functions/` proxies + signup still work; confirm homepage parity.
- Reality Check NOT linked in nav yet; hub not publicly surfaced.
- **Zero-entry build:** the `reality-check` collection + hub must build cleanly with no published entries (water/energy authored as `draft: true` or absent). Hub renders a graceful empty state; since it's unlinked, no visitor reaches it. Confirm the build does not error on an empty collection.
- Merge → confirm production deploy unchanged for visitors.

**PR 2 — Water page + public launch.**
- Write fully-cited `water.mdx` from the cheatsheet/research-notes/Ars source.
- Wire copy/share components with real content.
- Turn ON the Reality Check nav link + footer link. This is the public launch of the section.
- Verify live: copy buttons work, citations resolve, share blurb copies, OG/sitemap correct.

**PR 3 — Energy page.**
- Run `/research` → verified `research-notes.md` for energy.
- Write `energy.mdx`; add to hub.
- Verify live.

## 9. Out of scope (noted for later)

- Newsletter cross-pollination (pulling Reality Check stats into issues).
- Graphics/meme generator + per-page share images.
- Phase 5 resource/tracker/guide pages (will fold into the hub later under their categories).
- Additional narrative pages beyond water + energy (job displacement, copyright, "AI is hype").

## 10. Risks

1. **Pages Functions + build (highest).** Mitigated by preview-deploy verification + documented fallbacks (§3).
2. **Homepage regression** during Astro migration. Mitigated by parity diff + snapshot + CF rollback.
3. **Factual error on a credibility-dependent page.** Mitigated by verify-first sourcing, verified-date stamps, source-range notes, and energy gated behind a research pass.
4. **Scope creep** (the hub invites endless pages). Mitigated by shipping water + energy only; everything else explicitly deferred.
```
