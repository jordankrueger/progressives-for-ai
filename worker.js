/**
 * Cloudflare Worker: Newsletter Signup
 *
 * Routes signups to ListMonk lists based on the `list` field in the request body.
 * Optionally fires a Resend transactional welcome email if `bonus` matches a known key.
 *
 * SETUP (Cloudflare Dashboard > Workers > progressives-signup > Settings > Variables):
 *   - LISTMONK_URL:          https://newsletter.campaign.help
 *   - ALLOWED_ORIGINS:       https://progressivesforai.com,https://jordankrueger.com,https://groundedai.help
 *   - LISTMONK_API_USER:     api-automation
 *   - LISTMONK_API_PASSWORD: (secret) Listmonk API token for the api-automation user
 *   - RESEND_API_KEY:        (secret) Resend API key for sending bonus welcome emails
 *
 * Uses the authenticated /api/subscribers endpoint with preconfirm_subscriptions=true
 * so single-opt-in subscribers land as `confirmed` immediately. The unauthenticated
 * /api/public/subscription endpoint always creates rows as `unconfirmed`.
 */

const LIST_IDS = {
  'progressives-for-ai': 3,
  'mission-control': 4,
  'hsr-tv': 5,
  'great-southern-brood': 14,
};

// Draft campaign on list 4 that is never sent. Its UUID lets the bonus email carry
// Listmonk's own unsubscribe link, which unsubscribes from that campaign's lists.
const MC_UNSUB_CAMPAIGN_UUID = '5ab4ac56-2b70-4924-b747-16c487b284af';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BONUS_EMAILS = {
  'ak-template': {
    from: 'Jordan Krueger <jordan@jordankrueger.com>',
    subject: 'Here\'s that ActionKit Production Template',
    text: `Hi,

Thanks for grabbing my ActionKit Production Template. Here's the link to make a copy in Google Docs:

https://docs.google.com/document/u/1/d/1uFz6ZFViUU3nZhrewiRrqwOUaQCY08MrwJzIdLooMRQ/copy

A few other things on jordankrueger.com you might find useful:

- jordankrueger.com/ai -- AI projects I've built recently with Claude Code.
- jordankrueger.com/blog -- Posts about running a nonprofit consultancy, AI in advocacy, and the systems I build along the way.

The two things that pay the bills:

- CampaignHelp (campaign.help) -- My consulting practice. I help progressive nonprofits with ActionKit, tool migrations, workflow automation, and digital security. If you're stuck on something AK-related and want a person to look at it, this is the door.
- AK Help (akhelp.campaign.help) -- An AI assistant trained on the ActionKit docs that answers questions instantly, instead of making you wait on a support ticket. Built for AK admins like you.

You're now subscribed to Mission Control, my newsletter. I send it when I have something genuinely useful to share, not on a schedule. You can unsubscribe using the link at the bottom of any newsletter you receive, of course!

Thanks for being here,
Jordan`,
    html: `<p>Hi,</p>
<p>Thanks for grabbing my ActionKit Production Template. Here's the link to make a copy in Google Docs:</p>
<p><a href="https://docs.google.com/document/u/1/d/1uFz6ZFViUU3nZhrewiRrqwOUaQCY08MrwJzIdLooMRQ/copy"><strong>Open the AK Production Template &rarr;</strong></a></p>
<p>A few other things on <a href="https://jordankrueger.com">jordankrueger.com</a> you might find useful:</p>
<ul>
  <li><a href="https://jordankrueger.com/ai">/ai</a> &mdash; AI projects I've built recently with Claude Code.</li>
  <li><a href="https://jordankrueger.com/blog">/blog</a> &mdash; Posts about running a nonprofit consultancy, AI in advocacy, and the systems I build along the way.</li>
</ul>
<p>The two things that pay the bills:</p>
<ul>
  <li><strong><a href="https://campaign.help">CampaignHelp</a></strong> &mdash; My consulting practice. I help progressive nonprofits with ActionKit, tool migrations, workflow automation, and digital security. If you're stuck on something AK-related and want a person to look at it, this is the door.</li>
  <li><strong><a href="https://akhelp.campaign.help">AK Help</a></strong> &mdash; An AI assistant trained on the ActionKit docs that answers questions instantly, instead of making you wait on a support ticket. Built for AK admins like you.</li>
</ul>
<p>You're now subscribed to Mission Control, my newsletter. I send it when I have something genuinely useful to share, not on a schedule. You can unsubscribe using the link at the bottom of any newsletter you receive, of course!</p>
<p>Thanks for being here,<br>Jordan</p>`,
  },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    const originAllowed = allowedOrigins.includes(origin);

    // Browsers always send Origin on cross-origin POSTs, including native form posts.
    if ((request.method === 'OPTIONS' || request.method === 'POST') && !originAllowed) {
      return jsonResponse({ error: 'Forbidden' }, 403, '');
    }
    const allowedOrigin = originAllowed ? origin : '';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, allowedOrigin);
    }

    // Native (no-JavaScript) form posts get an HTML page back; JSON callers keep JSON.
    const contentType = request.headers.get('Content-Type') || '';
    const isForm = /^(application\/x-www-form-urlencoded|multipart\/form-data)/i.test(contentType);
    const reply = (data, status, listKey) => {
      // Opt-outs and blocklists stay protected without revealing membership to the caller.
      const acknowledgment = listKey === 'great-southern-brood' && data.success
        ? 'Thanks. If this address is subscribed, we’ll email you when it’s out.'
        : undefined;
      return isForm
        ? htmlResponse(data, status, allowedOrigin, acknowledgment)
        : jsonResponse(acknowledgment ? { ...data, message: acknowledgment } : data, status, allowedOrigin);
    };

    try {
      const data = isForm ? Object.fromEntries(await request.formData()) : await request.json();
      const { email, name, list, bonus } = data;

      if (!email || !isValidEmail(email)) {
        return reply({ error: 'Please enter a valid email address' }, 400);
      }

      const listKey = list || 'progressives-for-ai';
      const listId = LIST_IDS[listKey];
      if (!listId) {
        return reply({ error: 'Invalid list' }, 400);
      }

      // This endpoint is shared with Progressives for AI. Jordan's widget is
      // hostname-scoped, so require it only for the Mission Control forms.
      if (listKey === 'mission-control') {
        const turnstileValid = await verifyTurnstile(
          data['cf-turnstile-response'],
          env.TURNSTILE_SECRET_KEY,
          request.headers.get('CF-Connecting-IP'),
          'newsletter',
        );
        if (!turnstileValid) {
          return reply({ error: 'Please complete the security check and try again.' }, 400);
        }
      }

      const listmonkUrl = env.LISTMONK_URL || 'https://newsletter.campaign.help';
      const apiUser = env.LISTMONK_API_USER || 'api-automation';
      const apiPassword = env.LISTMONK_API_PASSWORD;
      if (!apiPassword) {
        console.error('LISTMONK_API_PASSWORD secret not set');
        return reply({ error: 'Server misconfigured. Please try again.' }, 500);
      }
      const authHeader = 'Basic ' + btoa(`${apiUser}:${apiPassword}`);

      // Only the Turnstile-gated list may trigger a bonus email.
      const wantsBonus = listKey === 'mission-control' && bonus && Object.hasOwn(BONUS_EMAILS, bonus) && env.RESEND_API_KEY;

      const listmonkResponse = await fetch(`${listmonkUrl}/api/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          email,
          name: (typeof name === 'string' && name) || email.split('@')[0],
          status: 'enabled',
          lists: [listId],
          preconfirm_subscriptions: true,
        }),
      });

      if (!listmonkResponse.ok) {
        const errorData = await listmonkResponse.json().catch(() => ({}));
        const errMsg = (errorData && errorData.message) || '';
        // Already-subscribed is success from the user's perspective.
        if (listmonkResponse.status === 409 || /already exists|duplicate/i.test(errMsg)) {
          // Exists on some list already: add the requested list, leave their other lists alone.
          const existing = await addExistingToList(listmonkUrl, authHeader, email, listId);
          if (!existing) {
            return reply({ error: 'Unable to subscribe. Please try again.' }, 500);
          }
          // Returning subscribers still get what they asked for, unless they opted out.
          // ponytail: no per-address cooldown, so each Turnstile pass can resend to a known
          // address; one unsubscribe click stops it. Add a KV cooldown if it's ever abused.
          if (wantsBonus && existing.mayEmail) {
            await sendBonus(env, BONUS_EMAILS[bonus], email, listmonkUrl, existing.uuid);
          }
          return reply({ success: true, message: 'You\'re already subscribed.' }, 200, listKey);
        }
        console.error('ListMonk API error:', listmonkResponse.status, errorData);
        return reply({ error: 'Unable to subscribe. Please try again.' }, 500);
      }

      if (wantsBonus) {
        const created = await listmonkResponse.json().catch(() => ({}));
        await sendBonus(env, BONUS_EMAILS[bonus], email, listmonkUrl, created?.data?.uuid);
      }

      return reply({ success: true, message: 'Successfully subscribed!' }, 200, listKey);

    } catch (error) {
      console.error('Worker error:', error);
      return reply({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};

// Sends a bonus email via Resend with a self-serve unsubscribe link. Without a valid
// subscriber UUID there is no link, so nothing is sent. Never throws: the signup already succeeded.
async function sendBonus(env, bonusEmail, email, listmonkUrl, subUuid) {
  if (!UUID_RE.test(subUuid || '')) {
    console.error('Bonus email skipped: no subscriber UUID for the unsubscribe link');
    return;
  }
  const unsubUrl = `${listmonkUrl}/subscription/${MC_UNSUB_CAMPAIGN_UUID}/${subUuid}`;
  try {
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: bonusEmail.from,
        to: [email],
        subject: bonusEmail.subject,
        text: `${bonusEmail.text}\n\nUnsubscribe: ${unsubUrl}`,
        html: `${bonusEmail.html}\n<p style="font-size:12px;color:#666;"><a href="${unsubUrl}">Unsubscribe</a></p>`,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });
    if (!resendResp.ok) {
      console.error('Resend bonus email failed:', await resendResp.text());
    }
  } catch (err) {
    console.error('Resend bonus email error:', err);
  }
}

// Listmonk v6 has no email lookup parameter on GET /api/subscribers, only a raw SQL
// `query`. The email is interpolated into a single-quoted Postgres string, so it must
// match this allowlist (no backslash, double quote, semicolon, whitespace or parens)
// and have its single quotes doubled. With standard_conforming_strings on (Postgres
// default) nothing else can end the literal.
const LOOKUP_SAFE_EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+$/;

// Returns { uuid, mayEmail } when the subscriber is on the list afterwards (or is blocklisted
// and must be left alone, or the email can't be looked up); null on any failure. mayEmail is
// false for anyone blocklisted or unsubscribed from the list. Never logs the email.
async function addExistingToList(listmonkUrl, authHeader, email, listId) {
  if (!LOOKUP_SAFE_EMAIL.test(email)) {
    // Can't be put in the lookup safely: fall back to the old behavior (generic success).
    console.error('Existing subscriber lookup skipped: email failed strict check');
    return { uuid: null, mayEmail: false };
  }
  const headers = { 'Content-Type': 'application/json', 'Authorization': authHeader };
  const query = `LOWER(subscribers.email) = '${email.toLowerCase().replace(/'/g, "''")}'`;
  try {
    const lookup = await fetch(`${listmonkUrl}/api/subscribers?${new URLSearchParams({ query, per_page: '1' })}`, { headers });
    if (!lookup.ok) {
      console.error('ListMonk subscriber lookup failed:', lookup.status);
      return null;
    }
    const subscriber = ((await lookup.json()).data?.results || [])[0];
    if (!subscriber) {
      console.error('ListMonk subscriber lookup found no match after 409');
      return null;
    }
    // Never re-add someone who was blocklisted; answer as if it worked.
    if (subscriber.status === 'blocklisted') return { uuid: subscriber.uuid, mayEmail: false };
    // Already on the list in any state (including unsubscribed): leave it alone.
    const membership = (subscriber.lists || []).find(l => l.id === listId);
    if (membership) return { uuid: subscriber.uuid, mayEmail: membership.subscription_status !== 'unsubscribed' };

    const add = await fetch(`${listmonkUrl}/api/subscribers/lists`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ids: [subscriber.id], action: 'add', target_list_ids: [listId], status: 'confirmed' }),
    });
    if (!add.ok) {
      console.error('ListMonk add-to-list failed:', add.status);
      return null;
    }
    return { uuid: subscriber.uuid, mayEmail: true };
  } catch (error) {
    console.error('ListMonk add-to-list error:', error.name);
    return null;
  }
}

async function verifyTurnstile(token, secret, remoteIp, expectedAction) {
  if (!token || !secret || typeof token !== 'string') return false;

  const body = new URLSearchParams({ secret, response: token.slice(0, 2048) });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return false;

    const result = await response.json();
    return Boolean(
      result.success &&
      ['jordankrueger.com', 'www.jordankrueger.com'].includes(result.hostname) &&
      result.action === expectedAction
    );
  } catch (error) {
    console.error('Turnstile validation failed', error);
    return false;
  }
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function jsonResponse(data, status, allowedOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(allowedOrigin && { 'Access-Control-Allow-Origin': allowedOrigin }),
    },
  });
}

// Minimal page for native form posts. Echoes nothing from the request: the message is one of
// our own fixed strings and the link goes to an origin already matched against the allowlist.
function htmlResponse(data, status, allowedOrigin, acknowledgment = "You're on the list.") {
  const message = data.success ? acknowledgment : data.error;
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${message}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><p>${message}</p><p><a href="${allowedOrigin}">Back to the site</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': allowedOrigin } },
  );
}
