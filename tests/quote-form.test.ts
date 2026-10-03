import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/quote-form.ts', import.meta.url), 'utf8'));
function mount(fetcher: typeof fetch, options: { key?: string; bot?: boolean } = {}) {
  let submit!: (event: { preventDefault(): void }) => Promise<void>;
  let resets = 0;
  const button = { disabled: true };
  const label = { textContent: '' };
  const status = { textContent: '', dataset: { state: '' } };
  const fields: Record<string, string> = {
    name: 'Çağrı Öztürk', phone: '05551234567', email: 'customer@example.com',
    service: 'Mobilya Depolama', message: 'İstanbul’dan sevkiyat',
    subject: 'Cervan | Yeni teklif talebi', from_name: 'Cervan Lojistik',
  };
  if (options.bot) fields.botcheck = 'on';
  const form = {
    querySelector(selector: string) {
      if (selector === 'button[type="submit"]') return button;
      if (selector === '[data-submit-label]') return label;
      if (selector === 'input[name="access_key"]') return { value: options.key ?? 'test-form-key' };
    },
    addEventListener(_: string, callback: typeof submit) { submit = callback; },
    reportValidity: () => true,
    setAttribute() {}, removeAttribute() {}, reset() { resets++; },
  };
  class FakeFormData {
    get(name: string) { return fields[name] ?? null; }
    has(name: string) { return Object.hasOwn(fields, name); }
  }
  runInNewContext(source, {
    document: { querySelector: (selector: string) => selector === '#quote-form' ? form : status },
    FormData: FakeFormData, fetch: fetcher, AbortController,
    window: { setTimeout, clearTimeout },
  });
  return { submit: () => submit({ preventDefault() {} }), button, status, label, resets: () => resets };
}

test('form sends directly to Web3Forms and resets only after confirmed success', async () => {
  let calls = 0;
  const view = mount((async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.web3forms.com/submit');
    assert.equal(options?.method, 'POST');
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.access_key, 'test-form-key');
    assert.equal(payload.email, 'customer@example.com');
    assert.equal(payload.name, 'Çağrı Öztürk');
    assert.equal(payload.botcheck, false);
    assert.equal(payload.token, undefined);
    assert.equal(payload.website, undefined);
    return Response.json({ success: true });
  }) as typeof fetch);
  await view.submit();
  assert.equal(calls, 1);
  assert.equal(view.resets(), 1);
  assert.equal(view.status.dataset.state, 'success');
  assert.equal(view.button.disabled, false);
  assert.equal(view.label.textContent, 'Teklif talep et');
});

test('provider refusal, bad HTTP response and network failure preserve fields and re-enable button', async () => {
  for (const fetcher of [
    async () => Response.json({ success: false, message: 'private-provider-detail' }),
    async () => Response.json({ success: true }, { status: 400 }),
    async () => { throw new Error('network failure'); },
    async () => new Response('invalid JSON'),
  ]) {
    const view = mount(fetcher as typeof fetch);
    await view.submit();
    assert.equal(view.resets(), 0);
    assert.equal(view.status.dataset.state, 'error');
    assert.equal(view.button.disabled, false);
    assert.ok(!view.status.textContent.includes('private-provider-detail'));
  }
});

test('provider quota response shows a Turkish message and retains fields', async () => {
  const view = mount((async () => Response.json({ success: false }, { status: 429 })) as typeof fetch);
  await view.submit();
  assert.match(view.status.textContent, /sınır/);
  assert.equal(view.resets(), 0);
  assert.equal(view.button.disabled, false);
});

test('missing key and honeypot never call the provider', async () => {
  const noFetch = (async () => { assert.fail('Must not send'); }) as typeof fetch;
  const missing = mount(noFetch, { key: '' });
  assert.equal(missing.button.disabled, true);
  await missing.submit();
  assert.equal(missing.resets(), 0);
  assert.equal(missing.status.dataset.state, 'error');
  const bot = mount(noFetch, { bot: true });
  await bot.submit();
  assert.equal(bot.status.dataset.state, 'error');
});

test('double submission starts one request while the first is pending', async () => {
  let finish!: (value: Response) => void;
  let calls = 0;
  const view = mount((async () => {
    calls++;
    return new Promise<Response>(resolve => { finish = resolve; });
  }) as typeof fetch);
  const pending = view.submit();
  assert.equal(view.button.disabled, true);
  await view.submit();
  assert.equal(calls, 1);
  finish(Response.json({ success: true }));
  await pending;
  assert.equal(view.resets(), 1);
  assert.equal(view.button.disabled, false);
});
