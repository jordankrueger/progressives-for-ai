# Progressives for AI

A newsletter and community for progressives engaging thoughtfully with AI technology.

**Live site:** [progressivesforai.com](https://progressivesforai.com)

---

## Brand Guidelines

### Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Green** | `#1e6b4f` | Headers, links, primary actions, logo |
| **Primary Dark** | `#155240` | Hover states, gradients |
| **Primary Light** | `#e8f5f0` | Success backgrounds, icon backgrounds |
| **Accent Orange** | `#e85d04` | CTA buttons, highlights, warnings |
| **Accent Light** | `#fff3eb` | Error backgrounds, highlighted cards |
| **Text** | `#1a1a2e` | Body text, headings |
| **Text Muted** | `#4a5568` | Secondary text, descriptions |
| **Background** | `#ffffff` | Main background |
| **Background Alt** | `#f7fafc` | Section backgrounds |
| **Border** | `#e2e8f0` | Dividers, card borders, input borders |

### Typography

- **Font Family:** Inter (Google Fonts)
- **Fallbacks:** -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- **Weights used:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Logo

- **Icon:** 🌄 (sunrise emoji)
- **Text:** "Progressives for AI"
- **Style:** Icon + text, green color (`#1e6b4f`)

### Voice & Tone

- **Informed but accessible** — No jargon, explain concepts simply
- **Hopeful but realistic** — Acknowledge concerns, focus on solutions
- **Progressive values** — Center equity, workers, democracy, environment
- **Not alarmist or hype-driven** — "No hype, no doom"

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Astro (`output: 'static'`, mdx + sitemap) — mirrors jordankrueger.com |
| **Hosting** | Cloudflare Pages (build: `npm run build` → `dist/`; Node pinned via `.nvmrc`) |
| **Source Control** | GitHub (`jordankrueger/progressives-for-ai`) |
| **Newsletter Backend** | ListMonk (newsletter.campaign.help) |
| **Form Handler** | Cloudflare Workers (`worker.js`) |
| **Page Proxies** | Cloudflare Pages Functions (`functions/` — archive + RSS) |
| **Content** | MDX content collections (`src/content/reality-check/`) |
| **Styling** | Vanilla CSS (`src/styles/global.css`) |

---

## Project Structure

```
progressives-for-ai/
├── src/
│   ├── pages/
│   │   ├── index.astro              # Homepage
│   │   └── reality-check/
│   │       ├── index.astro          # Reality Check hub
│   │       └── [slug].astro         # Reality Check entry renderer
│   ├── content/reality-check/*.mdx  # Reality Check pages (living content)
│   ├── content.config.ts            # reality-check collection schema
│   ├── layouts/ (Base, RealityCheck)
│   ├── components/ (Header, Footer, NewsletterSignup, Stat,
│   │               TalkingPoints, SharePack, Sources, CopyButton)
│   └── styles/global.css
├── functions/          # Cloudflare Pages Functions: archive.xml.ts + archive/[[path]].ts
├── worker.js           # Cloudflare Worker (signup) — deployed separately, NOT via Pages build
├── wrangler.toml       # Config for the signup Worker only
├── astro.config.mjs / package.json / .nvmrc
└── embed-*.html        # Legacy standalone forms for external embeds
```

---

## Signup Flow

1. User enters email in form on `index.html`
2. JavaScript sends POST request to Cloudflare Worker
3. Worker validates email and calls ListMonk public subscription API
4. ListMonk adds subscriber to the specified list
5. User sees success message

### Cloudflare Worker

**Deployed at:** `https://progressives-signup.restless-salad-a31e.workers.dev`

Supports multiple lists via the `list` field in the request body:
- `progressives-for-ai` (default) — PfAI newsletter
- `mission-control` — Jordan's personal newsletter

**Environment Variables (set in Cloudflare Dashboard):**

| Variable | Description |
|----------|-------------|
| `LISTMONK_URL` | `https://newsletter.campaign.help` |
| `ALLOWED_ORIGINS` | Comma-separated origins (e.g. `https://progressivesforai.com,https://jordankrueger.com`) |

---

## Local Development

```bash
npm install
npm run dev        # Astro dev server (hot reload)
npm run build      # Production build → dist/
npm run preview    # Serve the built dist/ on :4321
```

**To test the `functions/` proxies locally** (they don't run under `astro dev`):

```bash
npm run build && npx wrangler pages dev dist
# then hit http://localhost:8788/archive.xml and /archive/<slug>
```

**Note:** Signup form submissions go to the production Cloudflare Worker even locally.

---

## Deployment

### Website (Cloudflare Pages)

Auto-deploys on push to `main`. The Pages project (`progressives-for-ai`) is configured with:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** pinned via `.nvmrc` (22)

```bash
git add .
git commit -m "Your commit message"
git push   # → Cloudflare Pages builds main and deploys
```

### ⚠️ Cloudflare Pages Functions + the Astro build (verified gotcha)

The `functions/` directory (the `/archive` and `/archive.xml` proxies) is a **Cloudflare Pages Functions** feature, separate from the Astro build. Pages reads `functions/` from the **project root** and compiles it independently of the build output dir. This was the main risk when migrating to a build step — **verified working** (June 2026) both locally (`wrangler pages dev dist`) and on a real preview deploy: `/archive.xml` and `/archive/<slug>` return 200 alongside the Astro `dist/` output.

Practical rules:
- Keep `functions/` at the **repo root**, not inside `src/` or `dist/`.
- `wrangler.toml` configures the **signup Worker only** (`name = "progressives-signup"`); Pages ignores it because it has no `pages_build_output_dir`. Don't add Pages config there.
- The signup Worker is deployed separately (below) — it is NOT built or deployed by the Pages git build.

### Reality Check content

Pages live in `src/content/reality-check/*.mdx`. To add one: create an `.mdx` file with the frontmatter schema in `src/content.config.ts` (title, dek, category, topic, published, updated, changelog, sourceCount), set `draft: false` to publish, and it auto-appears in the hub grouped by `category`. Every statistic must cite a verified source (see the `2026-*-claim/research-notes.md` folders).

### Worker (Cloudflare Workers)

If you need to update the worker:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages
2. Select `progressives-signup`
3. Edit code or update environment variables
4. Click "Save and Deploy"

Or use Wrangler CLI:

```bash
cd worker
wrangler publish
```

---

## ListMonk Integration

**Instance:** https://newsletter.campaign.help (CampaignHelp VPS)
**Public API:** `POST /api/public/subscription` (no auth required)

### Lists

| List | UUID | Sending Domain |
|------|------|---------------|
| Progressives for AI | `2b5e7218-a0fc-4623-a6cb-1c98f47379cd` | progressivesforai.com |
| Mission Control | `d11cd3d8-d706-4edf-a724-9725cbd2e3f0` | jordankrueger.com |

### Subscriber Data Sent

```json
{
  "email": "user@example.com",
  "name": "",
  "list_uuids": ["2b5e7218-a0fc-4623-a6cb-1c98f47379cd"]
}
```

---

## Future Enhancements

- [ ] Add additional form fields (first name, interests)
- [ ] Create archive page for past newsletters
- [ ] Add social sharing meta tags (Open Graph, Twitter Cards)
- [ ] Implement dark mode
- [ ] Add analytics (privacy-respecting, e.g., Plausible or Fathom)
- [ ] Create "About" and "Resources" pages

---

*Built with care for a future where technology serves everyone.*
