import { services, site } from '../src/config/site.ts';
import { sendQuoteEmail } from './smtp.ts';

export interface QuoteEnv {
  SITE_URL?: string;
  SMTP_USER?: string;
  SMTP_APP_PASSWORD?: string;
  QUOTE_RECIPIENT?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const MAX_BODY_BYTES = 24_000;
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 254 && emailPattern.test(value);

function reply(status: number, message: string) {
  return Response.json({ ok: status === 200, message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleQuote(
  request: Request,
  env: QuoteEnv,
  fetcher: typeof fetch = fetch,
  deliver: typeof sendQuoteEmail = sendQuoteEmail,
) {
  if (request.method !== 'POST') {
    const response = reply(405, 'Bu işlem için formu kullanın.');
    response.headers.set('Allow', 'POST');
    return response;
  }

  let origin: URL;
  try {
    origin = new URL(env.SITE_URL || site.url);
  } catch {
    return reply(503, 'Teklif formu şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
  }
  if (request.headers.get('origin') !== origin.origin) {
    return reply(403, 'Talep doğrulanamadı. Lütfen site üzerindeki formu kullanın.');
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return reply(415, 'Geçersiz istek biçimi.');
  }

  let data: Record<string, unknown>;
  try {
    const body = await readBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SyntaxError();
    data = body as Record<string, unknown>;
  } catch (error) {
    return reply(error instanceof RangeError ? 413 : 400, 'Form bilgileri okunamadı. Lütfen alanları kontrol edin.');
  }

  const field = (key: string) => typeof data[key] === 'string' ? data[key].trim() : '';
  const name = field('name');
  const phone = field('phone');
  const email = field('email');
  const service = field('service');
  const message = field('message');
  const token = field('token');
  if (field('website')) return reply(400, 'Talep doğrulanamadı.');
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) {
    return reply(400, 'Lütfen adınızı ve soyadınızı kontrol edin.');
  }
  const digits = phone.replace(/\D/g, '');
  if (phone.length > 30 || !/^[+\d\s().-]+$/.test(phone) || /[\r\n]/.test(phone) || digits.length < 7 || digits.length > 15) {
    return reply(400, 'Lütfen geçerli bir telefon numarası yazın.');
  }
  if (!isEmail(email)) return reply(400, 'Lütfen geçerli bir e-posta adresi yazın.');
  if (!services.some((item) => item.title === service)) return reply(400, 'Lütfen bir hizmet türü seçin.');
  if (message.length > 4000) return reply(400, 'Notunuz en fazla 4000 karakter olabilir.');
  if (!token || token.length > 2048) return reply(400, 'Lütfen güvenlik doğrulamasını tamamlayın.');

  const recipient = env.QUOTE_RECIPIENT || env.SMTP_USER;
  if (!env.SMTP_APP_PASSWORD?.replace(/\s/g, '') ||
      !env.TURNSTILE_SECRET_KEY || !isEmail(env.SMTP_USER) || !isEmail(recipient)) {
    return reply(503, 'Teklif formu şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
  }

  let stage = 'turnstile';
  try {
    const verificationResponse = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!verificationResponse.ok) throw new Error('upstream');
    const verification = await verificationResponse.json() as { success?: boolean; hostname?: string; action?: string };
    if (verification.success !== true || verification.hostname !== origin.hostname || verification.action !== 'quote') {
      return reply(400, 'Güvenlik doğrulamasının süresi dolmuş olabilir. Lütfen yeniden doğrulayın.');
    }

    const body = [
      'Web sitesinden yeni teklif talebi', '',
      `Ad soyad: ${name}`, `Telefon: ${phone}`, `E-posta: ${email}`,
      `Hizmet: ${service}`, '', 'Not:', message || '(Not eklenmedi.)', '',
      'Bu e-postayı yanıtlayarak doğrudan müşteriye ulaşabilirsiniz.',
    ].join('\r\n');
    stage = 'smtp-send';
    await deliver({ SMTP_USER: env.SMTP_USER, SMTP_APP_PASSWORD: env.SMTP_APP_PASSWORD }, {
      to: recipient, replyTo: email, text: body,
    });
    return reply(200, 'Teklif talebiniz iletildi. En kısa sürede sizinle iletişime geçeceğiz.');
  } catch {
    // Do not log customer data, provider responses or credentials.
    console.error(`Quote request failed at ${stage}`);
    return reply(502, 'Gönderim onaylanamadı. Lütfen biraz sonra tekrar deneyin.');
  }
}
