// Minimal client for TypeSafe's Jev (System One). Same request shape as Jordan's jev.py:
// POST {state, model, questions} with a Bearer key; each "noul" question comes back as a
// probability (0-1) that the statement holds. The key is read only from TYPESAFE_API_KEY
// and never logged or put in an error.
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-latest';
export const JEV_USD_PER_M_INPUT = 0.042; // output tokens are billed at zero
// State + longest question must stay under 32K tokens; ~3 chars/token is pessimistic.
export const MAX_STATE_CHARS = 60000;

export class JevError extends Error {}

export const noul = (instructions) => ({ type: 'noul', instructions });

export async function askJev(state, questions, {
  key = process.env.TYPESAFE_API_KEY,
  fetchImpl = fetch,
  model = JEV_MODEL,
  attempts = 4,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  if (!key) throw new JevError('TYPESAFE_API_KEY is not set');
  const body = JSON.stringify({ state, model, questions });
  if (body.length > MAX_STATE_CHARS + 4000) throw new JevError('Jev request too large; clip the page text');
  for (let i = 0; i < attempts; i++) {
    let res;
    try {
      res = await fetchImpl(JEV_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      if (i < attempts - 1) { await sleep(2 ** i * 1000); continue; }
      throw new JevError(`could not reach TypeSafe (${e.name})`);
    }
    if ((res.status === 429 || res.status === 529) && i < attempts - 1) {
      await sleep((Number(res.headers.get('retry-after')) || 2 ** i) * 1000);
      continue;
    }
    // Error bodies describe the request, not the key, but don't echo them anyway.
    if (!res.ok) throw new JevError(`TypeSafe returned HTTP ${res.status}`);
    const payload = await res.json();
    const answers = {};
    for (const id of Object.keys(questions)) {
      const a = payload.answers?.[id];
      if (a?.type !== 'noul' || typeof a.noul !== 'number') throw new JevError(`TypeSafe did not answer "${id}"`);
      answers[id] = a.noul;
    }
    return { answers, inputTokens: payload.usage?.input_tokens ?? 0 };
  }
  throw new JevError('TypeSafe still failing after retries');
}
