import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleQuote, type QuoteEnv } from '../server/quote.ts';
import { onRequest } from '../functions/api/quote.ts';

const env: QuoteEnv = {
  SITE_URL: 'https://cervanlojistik.com', SMTP_USER: 'info@example.com',
  SMTP_APP_PASSWORD: 'test-app-password', TURNSTILE_SECRET_KEY: 'test-turnstile',
};
const payload = {
  name: 'Çağrı Öztürk', phone: '+90 (555) 123 45 67', email: 'customer@example.com',
  service: 'Mobilya Depolama', message: 'İstanbul’dan Ankara’ya sevkiyat.', token: 'test-token', website: '',
};
function request(body: unknown = payload, origin = env.SITE_URL!) {
  return new Request(`${env.SITE_URL}/api/quote`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const noFetch = (async () => { assert.fail('Invalid request must not contact upstream services'); }) as typeof fetch;

test('successful delivery preserves Turkish characters and replies go to the customer', async () => {
  const calls: string[] = [];
  const fetcher = (async (url, options) => {
    calls.push(String(url));
    assert.equal((options?.body as URLSearchParams).get('response'), payload.token);
    return Response.json({ success: true, hostname: 'cervanlojistik.com', action: 'quote' });
  }) as typeof fetch;
  let sent = 0;
  const response = await handleQuote(request(), env, fetcher, async (credentials, email) => {
    assert.equal(credentials.SMTP_USER, env.SMTP_USER);
    assert.equal(email.to, env.SMTP_USER);
    assert.equal(email.replyTo, payload.email);
    assert.ok(email.text.includes(payload.name));
    assert.ok(email.text.includes(payload.message));
    sent++;
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(sent, 1);
  assert.deepEqual(calls, ['https://challenges.cloudflare.com/turnstile/v0/siteverify']);
});

test('blocks foreign origins, non-POST methods and wrong content types', async () => {
  assert.equal((await handleQuote(request(payload, 'https://attacker.example'), env, noFetch)).status, 403);
  const response = await handleQuote(new Request(`${env.SITE_URL}/api/quote`), env, noFetch);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  const invalid = request();
  invalid.headers.set('content-type', 'text/plain');
  assert.equal((await handleQuote(invalid, env, noFetch)).status, 415);
});

test('rejects invalid fields, header injection, bots and oversized messages before sending', async () => {
  for (const override of [
    { name: '' }, { name: 'A\r\nB' }, { phone: 'abc1234567' }, { phone: '123' },
    { email: 'x@example.com\r\nBcc: attacker@example.com' }, { email: 'a@b' },
    { service: 'unknown' }, { message: 'a'.repeat(4001) }, { token: '' }, { website: 'spam.example' },
  ]) {
    assert.equal((await handleQuote(request({ ...payload, ...override }), env, noFetch)).status, 400);
  }
  assert.equal((await handleQuote(request({ ...payload, message: 'a'.repeat(25000) }), env, noFetch)).status, 413);
  assert.equal((await handleQuote(request(null), env, noFetch)).status, 400);
  assert.equal((await handleQuote(request([]), env, noFetch)).status, 400);
});

test('missing configuration fails closed', async () => {
  assert.equal((await handleQuote(request(), {}, noFetch)).status, 503);
  assert.equal((await handleQuote(request(), { ...env, SMTP_USER: 'bad\r\nheader' }, noFetch)).status, 503);
  assert.equal((await handleQuote(request(), { ...env, SMTP_APP_PASSWORD: '   ' }, noFetch)).status, 503);
});

test('Turnstile must match the site and form action', async () => {
  for (const result of [
    { success: false },
    { success: true, hostname: 'attacker.example', action: 'quote' },
    { success: true, hostname: 'cervanlojistik.com', action: 'other' },
  ]) {
    let calls = 0;
    const fetcher = (async () => { calls++; return Response.json(result); }) as typeof fetch;
    assert.equal((await handleQuote(request(), env, fetcher)).status, 400);
    assert.equal(calls, 1);
  }
});

test('provider failures never report success or expose provider data', async () => {
  for (const failureStage of ['turnstile', 'smtp']) {
    let sends = 0;
    const fetcher = (async () => {
      if (failureStage === 'turnstile') return Response.json({ secret: 'private-provider-detail' }, { status: 500 });
      return Response.json({ success: true, hostname: 'cervanlojistik.com', action: 'quote' });
    }) as typeof fetch;
    const response = await handleQuote(request(), env, fetcher, async () => {
      sends++;
      throw new Error('private-provider-detail');
    });
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.ok(!body.includes('private-provider-detail'));
    assert.equal(JSON.parse(body).ok, false);
    assert.equal(sends, failureStage === 'smtp' ? 1 : 0);
  }
});

test('the recipient comes from server settings, never visitor input', async () => {
  const fetcher = (async () => Response.json({ success: true, hostname: 'cervanlojistik.com', action: 'quote' })) as typeof fetch;
  const response = await handleQuote(request({ ...payload, to: 'attacker@example.com' }),
    { ...env, QUOTE_RECIPIENT: 'quotes@example.com' }, fetcher, async (_, email) => {
      assert.equal(email.to, 'quotes@example.com');
    });
  assert.equal(response.status, 200);
});

test('Pages Function delegates method and origin validation to the handler', async () => {
  assert.equal((await onRequest({ request: new Request(`${env.SITE_URL}/api/quote`), env })).status, 405);
  assert.equal((await onRequest({ request: request(payload, 'https://attacker.example'), env })).status, 403);
});
