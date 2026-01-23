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
| **Newsletter Backend** | Beehiiv |
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
3. Worker validates email and calls Beehiiv API
4. Beehiiv adds subscriber and sends welcome email
5. User sees success message

### Cloudflare Worker

**Deployed at:** `https://progressives-signup.restless-salad-a31e.workers.dev`

**Environment Variables (set in Cloudflare Dashboard):**

| Variable | Description |
|----------|-------------|
| `BEEHIIV_API_KEY` | API key from Beehiiv Settings → Integrations → API |
| `BEEHIIV_PUBLICATION_ID` | Publication ID (from Beehiiv URL, e.g., `pub_xxxxx`) |
| `ALLOWED_ORIGIN` | `https://progressivesforai.com` |

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

## Beehiiv Integration

**Publication:** Jordan's Newsletter (rename in Beehiiv settings if desired)

### API Endpoints Used

- `POST /v2/publications/{id}/subscriptions` — Add new subscriber

### Subscriber Data Sent

```json
{
  "email": "user@example.com",
  "reactivate_existing": true,
  "send_welcome_email": true,
  "utm_source": "website",
  "utm_medium": "custom_form"
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

## Contact

**Email:** anthropic@pandemicsoul.com

---

*Built with care for a future where technology serves everyone.*
