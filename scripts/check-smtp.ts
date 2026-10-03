import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createTransport } from 'nodemailer';
import { smtpOptions } from '../server/smtp.ts';
import { mailDiagnostics } from '../server/mail-diagnostics.ts';

async function main() {
  let env: Record<string, string>;
  try {
    env = parseEnv(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8'));
  } catch {
    console.error('.dev.vars okunamadı. .dev.vars.example dosyasını .dev.vars olarak kopyalayın.');
    process.exitCode = 1;
    return;
  }
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !password) {
    console.error('.dev.vars dosyasındaki SMTP_USER ve SMTP_APP_PASSWORD alanlarını doldurun. Şifreyi sohbete göndermeyin.');
    process.exitCode = 1;
    return;
  }
  const transport = createTransport(smtpOptions({ SMTP_USER: user, SMTP_APP_PASSWORD: password }));
  try {
    await transport.verify();
    console.log('SMTP bağlantısı, TLS ve Google oturum açma doğrulandı. E-posta gönderilmedi.');
    console.log('Bu sonuç yerel bağlantı içindir; Cloudflare bağlantısını veya gelen kutusuna teslimi doğrulamaz.');
  } catch (error) {
    const diagnostic = mailDiagnostics(error);
    console.error('SMTP kontrolü başarısız:', diagnostic);
    if (diagnostic.code === 'EAUTH') {
      console.error('Google oturum açmayı reddetti. Uygulama şifresinin SMTP_USER hesabına ait olduğunu kontrol edin.');
    } else {
      console.error('Bağlantı veya TLS kontrolü tamamlanamadı. Yukarıdaki hata kodunu paylaşabilirsiniz.');
    }
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}

await main();
