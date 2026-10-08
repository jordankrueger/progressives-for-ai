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

test('subscribes Great Southern Brood signups to list 14 with no Turnstile and allows that origin', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({ data: { id: 1 } });
  };
  const gsbEnv = {
    ...env,
    ALLOWED_ORIGINS: 'https://jordankrueger.com,https://greatsouthernbrood.com',
  };

  const response = await worker.fetch(new Request('https://signup.example.com', {
    method: 'POST',
    headers: { Origin: 'https://greatsouthernbrood.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jordan@example.com', list: 'great-southern-brood' }),
  }), gsbEnv);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://greatsouthernbrood.com');
  assert.deepEqual(calls.map(c => c.url), ['https://newsletter.example.com/api/subscribers']);
  assert.deepEqual(calls[0].body.lists, [14]);
});

test('wrangler.toml allows the Great Southern Brood origin alongside the existing ones', async () => {
  const { readFileSync } = await import('node:fs');
  const line = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8')
    .split('\n').find(l => l.startsWith('ALLOWED_ORIGINS'));
  const origins = line.match(/"(.*)"/)[1].split(',');
  assert.deepEqual(origins, [
    'https://progressivesforai.com',
    'https://jordankrueger.com',
    'https://groundedai.help',
    'https://highspeedrail.tv',
    'https://hsr.fyi',
    'https://greatsouthernbrood.com',
  ]);
});
