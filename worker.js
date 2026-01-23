/**
 * Cloudflare Worker: Progressives for AI Newsletter Signup
 *
 * This worker receives email signups from your custom forms and adds
 * subscribers directly to Beehiiv via their API.
 *
 * SETUP:
 * 1. Create a new Worker in Cloudflare Dashboard
 * 2. Paste this code
 * 3. Add these environment variables (Settings > Variables):
 *    - BEEHIIV_API_KEY: Your Beehiiv API key
 *    - BEEHIIV_PUBLICATION_ID: Your publication ID (found in Beehiiv URL)
 *    - ALLOWED_ORIGIN: https://progressivesforai.com
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, env);
    }

    try {
      const { email } = await request.json();

      // Validate email
      if (!email || !isValidEmail(email)) {
        return jsonResponse({ error: 'Please enter a valid email address' }, 400, env);
      }

      // Add subscriber to Beehiiv
      const beehiivResponse = await fetch(
        `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.BEEHIIV_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            reactivate_existing: true,
            send_welcome_email: true,
            utm_source: 'website',
            utm_medium: 'custom_form',
          }),
        }
      );

      if (!beehiivResponse.ok) {
        const errorData = await beehiivResponse.json().catch(() => ({}));
        console.error('Beehiiv API error:', errorData);

        // Handle specific Beehiiv errors
        if (beehiivResponse.status === 409) {
          // Already subscribed - treat as success
          return jsonResponse({ success: true, message: 'Welcome back!' }, 200, env);
        }

        return jsonResponse({ error: 'Unable to subscribe. Please try again.' }, 500, env);
      }

      const result = await beehiivResponse.json();
      return jsonResponse({ success: true, message: 'Successfully subscribed!' }, 200, env);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500, env);
    }
  },
};

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function jsonResponse(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': env?.ALLOWED_ORIGIN || '*',
    },
  });
}
