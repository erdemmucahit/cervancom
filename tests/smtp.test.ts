import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createTransport } from 'nodemailer';
import { sendQuoteEmail } from '../server/smtp.ts';

// This loopback-only SMTP fixture never relays messages or contacts Google.
async function smtpFixture(failure: 'auth' | 'recipient' | 'data' | undefined = undefined) {
  const commands: string[] = [];
  let message = '';
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    socket.on('error', () => {});
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '';
    let receivingData = false;
    socket.on('data', (chunk) => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (receivingData) {
          if (line !== '.') { message += `${line}\r\n`; continue; }
          receivingData = false;
          socket.write(failure === 'data' ? '451 temporary failure\r\n' : '250 2.0.0 accepted\r\n');
          continue;
        }
        commands.push(line);
        if (line.startsWith('EHLO')) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH PLAIN ')) socket.write(failure === 'auth' ? '535 invalid credentials\r\n' : '235 authenticated\r\n');
        else if (line.startsWith('MAIL FROM:')) socket.write('250 OK\r\n');
        else if (line.startsWith('RCPT TO:')) socket.write(failure === 'recipient' ? '550 rejected\r\n' : '250 OK\r\n');
        else if (line === 'DATA') { receivingData = true; socket.write('354 send data\r\n'); }
        else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('500 unexpected command\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test port');
  return {
    commands,
    message: () => message,
    transport: (options: Parameters<typeof createTransport>[0]) => {
      assert.equal(typeof options, 'object');
      const config = options as Record<string, unknown>;
      assert.equal(config.host, 'smtp.gmail.com');
      assert.equal(config.port, 465);
      assert.equal(config.secure, true);
      assert.deepEqual(config.tls, { servername: 'smtp.gmail.com', rejectUnauthorized: true });
      assert.equal(config.logger, false);
      return createTransport({
        ...config, host: '127.0.0.1', port: address.port,
        secure: false, ignoreTLS: true, tls: undefined, getSocket: undefined,
      });
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const credentials = { SMTP_USER: 'info@example.com', SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop' };
const email = { to: 'quotes@example.com', replyTo: 'customer@example.com', text: 'Çağrı Öztürk\r\nMobilya depolama, İstanbul.' };

test('SMTP authenticates, transmits UTF-8 MIME and waits for final acceptance', async () => {
  const fixture = await smtpFixture();
  try {
    await sendQuoteEmail(credentials, email, fixture.transport);
    const auth = fixture.commands.find((line) => line.startsWith('AUTH PLAIN '));
    assert.equal(Buffer.from(auth!.slice(11), 'base64').toString(), '\0info@example.com\0abcdefghijklmnop');
    assert.ok(fixture.commands.includes('MAIL FROM:<info@example.com>'));
    assert.ok(fixture.commands.includes('RCPT TO:<quotes@example.com>'));
    const [headers, body] = fixture.message().split('\r\n\r\n');
    assert.match(headers, /From: Cervan <info@example.com>/);
    assert.match(headers, /Reply-To: customer@example.com/);
    assert.equal(Buffer.from(body, 'base64').toString('utf8'), email.text);
  } finally { await fixture.close(); }
});

for (const failure of ['auth', 'recipient', 'data'] as const) {
  test(`SMTP rejects ${failure} failures without retrying`, async () => {
    const fixture = await smtpFixture(failure);
    try {
      await assert.rejects(sendQuoteEmail(credentials, email, fixture.transport));
      assert.equal(fixture.commands.filter((line) => line.startsWith('EHLO')).length, 1);
      if (failure !== 'data') assert.equal(fixture.message(), '');
    } finally { await fixture.close(); }
  });
}
