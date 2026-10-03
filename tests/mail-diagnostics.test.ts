import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mailDiagnostics } from '../server/mail-diagnostics.ts';

test('diagnostics distinguish authentication, connection and timeout failures without provider text', () => {
  assert.deepEqual(mailDiagnostics({ code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN',
    message: 'private', response: 'private', stack: 'private' }),
  { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' });
  assert.deepEqual(mailDiagnostics({ code: 'ESOCKET', command: 'CONN' }), { code: 'ESOCKET', command: 'CONN' });
  assert.deepEqual(mailDiagnostics(new DOMException('private', 'TimeoutError')), { code: 'ETIMEDOUT' });
});

test('unexpected diagnostic properties cannot disclose credentials or customer addresses', () => {
  for (const error of [null, 'private', { code: 'private', responseCode: '535 private', command: 'AUTH PLAIN private' },
    { responseCode: 535.5 }, { responseCode: 900 }]) {
    assert.deepEqual(mailDiagnostics(error), { code: 'UNKNOWN' });
  }
});

test('timeouts identify whether TLS or the SMTP greeting was missing without copying messages', () => {
  assert.deepEqual(mailDiagnostics(Object.assign(new Error('smtp-connect-timeout'), { code: 'ETIMEDOUT', command: 'CONN' })),
    { code: 'ETIMEDOUT', command: 'CONN', reason: 'TLS_CONNECT_TIMEOUT' });
  assert.deepEqual(mailDiagnostics({ code: 'ETIMEDOUT', message: 'Greeting never received' }),
    { code: 'ETIMEDOUT', reason: 'SMTP_GREETING_TIMEOUT' });
  assert.deepEqual(mailDiagnostics({ message: 'smtp-connect-timeout private' }), { code: 'UNKNOWN' });
});
