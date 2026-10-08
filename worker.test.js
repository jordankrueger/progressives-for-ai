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

// --- existing subscriber (Listmonk 409) gets the requested list added ---

const LM = 'https://newsletter.example.com';

function listmonkMock({ lookup, addStatus = 200 }) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = init.method || 'GET';
    calls.push({ url: u, method, body: init.body ? JSON.parse(init.body) : null });
    if (method === 'POST' && u === `${LM}/api/subscribers`) {
      return Response.json({ message: 'E-mail already exists.' }, { status: 409 });
    }
    if (method === 'GET' && u.startsWith(`${LM}/api/subscribers?`)) {
      return Response.json({ data: { results: lookup } });
    }
    if (method === 'PUT' && u === `${LM}/api/subscribers/lists`) {
      return addStatus === 200 ? Response.json({ data: true }) : new Response('boom', { status: addStatus });
    }
    throw new Error(`unexpected ${method} ${u}`);
  };
  return calls;
}

test('409 on create: looks the subscriber up and adds the requested list', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = listmonkMock({ lookup: [{ id: 77, status: 'enabled' }] });

  const response = await worker.fetch(request({ list: 'hsr-tv' }), env);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  const lookup = calls.find(c => c.method === 'GET');
  assert.equal(
    new URL(lookup.url).searchParams.get('query'),
    "LOWER(subscribers.email) = 'jordan@example.com'",
  );
  const add = calls.find(c => c.method === 'PUT');
  assert.deepEqual(add.body, { ids: [77], action: 'add', target_list_ids: [5], status: 'confirmed' });
});

test('blocklisted existing subscriber: no add call, same generic success', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = listmonkMock({ lookup: [{ id: 77, status: 'blocklisted' }] });

  const response = await worker.fetch(request({ list: 'hsr-tv' }), env);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(calls.filter(c => c.method === 'PUT').length, 0);
});

test('add-to-list failure returns 500 and does not log the email', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  t.after(() => { globalThis.fetch = originalFetch; console.error = originalError; });
  listmonkMock({ lookup: [{ id: 77, status: 'enabled' }], addStatus: 500 });
  const logged = [];
  console.error = (...args) => logged.push(JSON.stringify(args));

  const response = await worker.fetch(request({ list: 'hsr-tv' }), env);

  assert.equal(response.status, 500);
  assert.ok(logged.length > 0);
  assert.ok(!logged.join('').includes('jordan@example.com'));
});

test('409 but lookup finds nobody: 500, no add call', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = listmonkMock({ lookup: [] });

  const response = await worker.fetch(request({ list: 'hsr-tv' }), env);

  assert.equal(response.status, 500);
  assert.equal(calls.filter(c => c.method === 'PUT').length, 0);
});

test('an email with a quote is doubled in the lookup; one with a backslash skips the lookup', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = listmonkMock({ lookup: [{ id: 9, status: 'enabled' }] });
  await worker.fetch(request({ list: 'hsr-tv', email: "o'brien@example.com" }), env);
  assert.equal(
    new URL(calls.find(c => c.method === 'GET').url).searchParams.get('query'),
    "LOWER(subscribers.email) = 'o''brien@example.com'",
  );

  calls = listmonkMock({ lookup: [{ id: 9, status: 'enabled' }] });
  const response = await worker.fetch(request({ list: 'hsr-tv', email: 'a\\b@example.com' }), env);
  assert.equal(calls.filter(c => c.method === 'GET').length, 0);
  assert.equal(response.status, 200);
});

// --- Codex review fixes ---

const hsrList = (subscription_status) => [{ id: 5, name: 'HSR', subscription_status }];

for (const [status, label] of [['unsubscribed', 'unsubscribed'], ['confirmed', 'already confirmed'], ['unconfirmed', 'already unconfirmed']]) {
  test(`existing membership (${label}) on the requested list: no PUT, generic success`, async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    const calls = listmonkMock({ lookup: [{ id: 77, status: 'enabled', lists: hsrList(status) }] });

    const response = await worker.fetch(request({ list: 'hsr-tv' }), env);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.equal(calls.filter(c => c.method === 'PUT').length, 0);
  });
}

test('on other lists only (requested list absent): PUT is made', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = listmonkMock({
    lookup: [{ id: 77, status: 'enabled', lists: [{ id: 3, name: 'PFAI', subscription_status: 'confirmed' }] }],
  });

  const response = await worker.fetch(request({ list: 'hsr-tv' }), env);

  assert.equal(response.status, 200);
  assert.equal(calls.filter(c => c.method === 'PUT').length, 1);
});

test('email the lookup cannot take (non-ASCII): old behavior, 200 already-subscribed, no lookup', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = listmonkMock({ lookup: [{ id: 77, status: 'enabled', lists: [] }] });

  const response = await worker.fetch(request({ list: 'hsr-tv', email: 'user@bücher.de' }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, message: "You're already subscribed." });
  assert.deepEqual(calls.map(c => c.method), ['POST']);
});

// --- hardening: origin required, bonus only on mission-control, no-JS form posts ---

const allEnv = {
  ...env,
  RESEND_API_KEY: 'resend_test',
  ALLOWED_ORIGINS: 'https://jordankrueger.com,https://hsr.fyi,https://greatsouthernbrood.com',
};

function recordFetch(t, handler) {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
    return handler ? handler(String(url)) : Response.json({ data: { id: 1 } });
  };
  return calls;
}

const post = (headers, body) => new Request('https://signup.example.com', {
  method: 'POST',
  headers,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('POST with no Origin header: 403, no outbound calls', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    post({ 'Content-Type': 'application/json' }, { email: 'jordan@example.com', list: 'hsr-tv' }), allEnv);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Forbidden' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(calls.length, 0);
});

test('POST from an origin not in ALLOWED_ORIGINS: 403, no outbound calls', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    post({ Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      { email: 'jordan@example.com', list: 'hsr-tv' }), allEnv);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Forbidden' });
  assert.equal(calls.length, 0);
});

test('POST with no Origin is refused even when ALLOWED_ORIGINS is empty', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    post({ 'Content-Type': 'application/json' }, { email: 'jordan@example.com', list: 'hsr-tv' }),
    { ...allEnv, ALLOWED_ORIGINS: '' });
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('OPTIONS from a disallowed origin: 403 and no Access-Control-Allow-Origin', async () => {
  const response = await worker.fetch(
    new Request('https://signup.example.com', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), allEnv);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('OPTIONS from an allowed origin echoes that origin', async () => {
  const response = await worker.fetch(
    new Request('https://signup.example.com', { method: 'OPTIONS', headers: { Origin: 'https://hsr.fyi' } }), allEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://hsr.fyi');
});

test('bonus field on hsr-tv: subscribes, no Resend call', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    post({ Origin: 'https://hsr.fyi', 'Content-Type': 'application/json' },
      { email: 'jordan@example.com', list: 'hsr-tv', bonus: 'ak-template' }), allEnv);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(c => c.url), ['https://newsletter.example.com/api/subscribers']);
});

test('bonus field on mission-control with a valid Turnstile token: Resend call is made', async (t) => {
  const calls = recordFetch(t, (url) => url.includes('/siteverify')
    ? Response.json({ success: true, hostname: 'jordankrueger.com', action: 'newsletter' })
    : Response.json({ data: { id: 1 } }));
  const response = await worker.fetch(request({ bonus: 'ak-template' }), allEnv);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(c => c.url), [
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    'https://newsletter.example.com/api/subscribers',
    'https://api.resend.com/emails',
  ]);
});

test('form-encoded POST from greatsouthernbrood.com: Listmonk list 14, HTML 200', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    post({ Origin: 'https://greatsouthernbrood.com', 'Content-Type': 'application/x-www-form-urlencoded' },
      'email=jordan%40example.com&list=great-southern-brood'), allEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const html = await response.text();
  assert.ok(html.includes("You're on the list."));
  assert.ok(html.includes('href="https://greatsouthernbrood.com"'));
  assert.deepEqual(calls.map(c => c.url), ['https://newsletter.example.com/api/subscribers']);
  assert.deepEqual(JSON.parse(calls[0].body).lists, [14]);
});

test('multipart POST (mission-control form fields) works and runs Turnstile', async (t) => {
  const calls = recordFetch(t, (url) => url.includes('/siteverify')
    ? Response.json({ success: true, hostname: 'jordankrueger.com', action: 'newsletter' })
    : Response.json({ data: { id: 1 } }));
  const fd = new FormData();
  fd.set('email', 'jordan@example.com');
  fd.set('list', 'mission-control');
  fd.set('cf-turnstile-response', 'valid-token');
  const response = await worker.fetch(
    new Request('https://signup.example.com', { method: 'POST', headers: { Origin: 'https://jordankrueger.com' }, body: fd }), allEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(calls.length, 2);
});

test('form-encoded POST with a bad email: HTML 400 that does not contain the submitted value', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    post({ Origin: 'https://greatsouthernbrood.com', 'Content-Type': 'application/x-www-form-urlencoded' },
      'email=%3Cscript%3Ealert(1)%3C%2Fscript%3E&list=great-southern-brood'), allEnv);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const html = await response.text();
  assert.ok(html.includes('Please enter a valid email address'));
  assert.ok(html.includes('href="https://greatsouthernbrood.com"'));
  assert.ok(!html.includes('script'));
  assert.equal(calls.length, 0);
});

test('JSON POST keeps its JSON response', async (t) => {
  recordFetch(t);
  const response = await worker.fetch(
    post({ Origin: 'https://hsr.fyi', 'Content-Type': 'application/json' },
      { email: 'jordan@example.com', list: 'hsr-tv' }), allEnv);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await response.json(), { success: true, message: 'Successfully subscribed!' });
});

// --- Codex review fixes: CORS on form responses, non-string multipart fields ---

function multipart(origin, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request('https://signup.example.com', { method: 'POST', headers: { Origin: origin }, body: fd });
}
const aFile = () => new File(['x'], 'x.txt', { type: 'text/plain' });

test('HTML responses to form posts carry Access-Control-Allow-Origin for the allowed origin', async (t) => {
  recordFetch(t);
  const ok = await worker.fetch(post(
    { Origin: 'https://hsr.fyi', 'Content-Type': 'application/x-www-form-urlencoded' },
    'email=jordan%40example.com&list=hsr-tv'), allEnv);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://hsr.fyi');
  const bad = await worker.fetch(post(
    { Origin: 'https://hsr.fyi', 'Content-Type': 'application/x-www-form-urlencoded' }, 'email=nope&list=hsr-tv'), allEnv);
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), 'https://hsr.fyi');
});

test('multipart email that is a File: 400 valid-email message, Listmonk never called', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(multipart('https://hsr.fyi', { email: aFile(), list: 'hsr-tv' }), allEnv);
  assert.equal(response.status, 400);
  assert.ok((await response.text()).includes('Please enter a valid email address'));
  assert.equal(calls.length, 0);
});

test('multipart list that is a File: 400 Invalid list, Listmonk never called', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    multipart('https://hsr.fyi', { email: 'jordan@example.com', list: aFile() }), allEnv);
  assert.equal(response.status, 400);
  assert.ok((await response.text()).includes('Invalid list'));
  assert.equal(calls.length, 0);
});

test('multipart name that is a File: ignored, Listmonk gets the email prefix as a string', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(
    multipart('https://hsr.fyi', { email: 'jordan@example.com', list: 'hsr-tv', name: aFile() }), allEnv);
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(calls[0].body).name, 'jordan');
});

test('multipart bonus that is a File on mission-control: no Resend call', async (t) => {
  const calls = recordFetch(t, (url) => url.includes('/siteverify')
    ? Response.json({ success: true, hostname: 'jordankrueger.com', action: 'newsletter' })
    : Response.json({ data: { id: 1 } }));
  const response = await worker.fetch(multipart('https://jordankrueger.com', {
    email: 'jordan@example.com', list: 'mission-control', 'cf-turnstile-response': 'valid-token', bonus: aFile(),
  }), allEnv);
  assert.equal(response.status, 200);
  assert.ok(!calls.some(c => c.url.includes('resend.com')));
});

test('non-string email (array that stringifies to a valid address): 400, Listmonk never called', async (t) => {
  const calls = recordFetch(t);
  const response = await worker.fetch(post({ Origin: 'https://hsr.fyi', 'Content-Type': 'application/json' },
    { email: ['jordan@example.com'], list: 'hsr-tv' }), allEnv);
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
