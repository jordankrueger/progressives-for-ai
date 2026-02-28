/**
 * Cloudflare Worker: Newsletter Signup
 *
 * Routes signups to ListMonk lists based on the `list` field in the request body.
 * Uses ListMonk's public subscription API (no auth required).
 *
 * SETUP:
 * 1. Create a new Worker in Cloudflare Dashboard
 * 2. Paste this code
 * 3. Add these environment variables (Settings > Variables):
 *    - LISTMONK_URL: https://newsletter.campaign.help
 *    - ALLOWED_ORIGINS: Comma-separated origins (e.g. https://progressivesforai.com,https://jordankrueger.com)
 */

const LIST_UUIDS = {
  'progressives-for-ai': '2b5e7218-a0fc-4623-a6cb-1c98f47379cd',
  'mission-control': 'd11cd3d8-d706-4edf-a724-9725cbd2e3f0',
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';

    // Handle CORS preflight
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

    // Only allow POST requests
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, allowedOrigin);
    }

    try {
      const { email, name, list } = await request.json();

      // Validate email
      if (!email || !isValidEmail(email)) {
        return jsonResponse({ error: 'Please enter a valid email address' }, 400, allowedOrigin);
      }

      // Resolve list UUID (default to progressives-for-ai)
      const listKey = list || 'progressives-for-ai';
      const listUUID = LIST_UUIDS[listKey];
      if (!listUUID) {
        return jsonResponse({ error: 'Invalid list' }, 400, allowedOrigin);
      }

      // Add subscriber via ListMonk public API
      const listmonkUrl = env.LISTMONK_URL || 'https://newsletter.campaign.help';
      const listmonkResponse = await fetch(`${listmonkUrl}/api/public/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: name || '',
          list_uuids: [listUUID],
        }),
      });

      if (!listmonkResponse.ok) {
        const errorData = await listmonkResponse.json().catch(() => ({}));
        console.error('ListMonk API error:', errorData);
        return jsonResponse({ error: 'Unable to subscribe. Please try again.' }, 500, allowedOrigin);
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
