import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './worker.js';

const env = {
  ALLOWED_ORIGINS: 'https://jordankrueger.com',
  TURNSTILE_SECRET_KEY: 'turnstile_test',
  LISTMONK_URL: 'https://newsletter.example.com',
  LISTMONK_API_USER: 'api-automation',
  LISTMONK_API_PASSWORD: 'listmonk_test',
};

function request(body) {
  return new Request('https://signup.example.com', {
    method: 'POST',
    headers: {
      Origin: 'https://jordankrueger.com',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'jordan@example.com',
      list: 'mission-control',
      'cf-turnstile-response': 'valid-token',
      ...body,
    }),
  });
}

test('rejects a missing Turnstile token before contacting Listmonk', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ success: true }); };

  const response = await worker.fetch(request({ 'cf-turnstile-response': '' }), env);

  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test('rejects a token Cloudflare identifies as automated', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
  };

  const response = await worker.fetch(request({}), env);

  assert.equal(response.status, 400);
  assert.equal(calls, 1);
});

test('accepts a valid Jordan token before subscribing to Mission Control', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('/siteverify')) {
      return Response.json({
        success: true,
        hostname: 'jordankrueger.com',
        action: 'newsletter',
      });
    }
    return Response.json({ data: { id: 1 } });
  };

  const response = await worker.fetch(request({}), env);

  assert.equal(response.status, 200);
  assert.deepEqual(urls, [
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    'https://newsletter.example.com/api/subscribers',
  ]);
});

test('keeps the shared Progressives for AI signup path working without Jordan Turnstile', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return Response.json({ data: { id: 1 } });
  };

  const response = await worker.fetch(request({
    list: 'progressives-for-ai',
    'cf-turnstile-response': '',
  }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(urls, ['https://newsletter.example.com/api/subscribers']);
});
