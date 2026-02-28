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
| **Hosting** | Cloudflare Pages |
| **Source Control** | GitHub |
| **Newsletter Backend** | ListMonk (newsletter.campaign.help) |
| **Form Handler** | Cloudflare Workers |
| **Styling** | Vanilla CSS (no frameworks) |

---

## Project Structure

```
progressives-for-ai/
├── index.html          # Main landing page
├── embed-hero.html     # Standalone hero form (legacy, for external embeds)
├── embed-footer.html   # Standalone footer form (legacy, for external embeds)
├── worker.js           # Cloudflare Worker source (deployed separately)
└── README.md           # This file
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

Since this is a static site, you can run it locally with any simple HTTP server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

**Note:** Form submissions will still go to the production Cloudflare Worker. For local testing of the worker, use `wrangler dev`.

---

## Deployment

### Website (Cloudflare Pages)

Deployments are automatic on push to the `main` branch on GitHub.

```bash
git add .
git commit -m "Your commit message"
git push
```

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
