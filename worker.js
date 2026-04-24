/**
 * Cloudflare Worker: Newsletter Signup
 *
 * Routes signups to ListMonk lists based on the `list` field in the request body.
 * Optionally fires a Resend transactional welcome email if `bonus` matches a known key.
 *
 * SETUP (Cloudflare Dashboard > Workers > progressives-signup > Settings > Variables):
 *   - LISTMONK_URL:          https://newsletter.campaign.help
 *   - ALLOWED_ORIGINS:       https://progressivesforai.com,https://jordankrueger.com
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
};

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
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    const allowedOrigin = allowedOrigins.includes(origin) ? origin : '*';

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

    try {
      const { email, name, list, bonus } = await request.json();

      if (!email || !isValidEmail(email)) {
        return jsonResponse({ error: 'Please enter a valid email address' }, 400, allowedOrigin);
      }

      const listKey = list || 'progressives-for-ai';
      const listId = LIST_IDS[listKey];
      if (!listId) {
        return jsonResponse({ error: 'Invalid list' }, 400, allowedOrigin);
      }

      const listmonkUrl = env.LISTMONK_URL || 'https://newsletter.campaign.help';
      const apiUser = env.LISTMONK_API_USER || 'api-automation';
      const apiPassword = env.LISTMONK_API_PASSWORD;
      if (!apiPassword) {
        console.error('LISTMONK_API_PASSWORD secret not set');
        return jsonResponse({ error: 'Server misconfigured. Please try again.' }, 500, allowedOrigin);
      }
      const authHeader = 'Basic ' + btoa(`${apiUser}:${apiPassword}`);

      const listmonkResponse = await fetch(`${listmonkUrl}/api/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          email,
          name: name || email.split('@')[0],
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
          return jsonResponse({ success: true, message: 'You\'re already subscribed.' }, 200, allowedOrigin);
        }
        console.error('ListMonk API error:', listmonkResponse.status, errorData);
        return jsonResponse({ error: 'Unable to subscribe. Please try again.' }, 500, allowedOrigin);
      }

      // Optional: fire bonus welcome email via Resend
      if (bonus && BONUS_EMAILS[bonus] && env.RESEND_API_KEY) {
        const bonusEmail = BONUS_EMAILS[bonus];
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
              text: bonusEmail.text,
              html: bonusEmail.html,
            }),
          });
          if (!resendResp.ok) {
            console.error('Resend bonus email failed:', await resendResp.text());
          }
        } catch (err) {
          console.error('Resend bonus email error:', err);
          // Don't fail the whole request — subscription succeeded
        }
      }

      return jsonResponse({ success: true, message: 'Successfully subscribed!' }, 200, allowedOrigin);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500, allowedOrigin);
    }
  },
};

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function jsonResponse(data, status, allowedOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin || '*',
    },
  });
}
