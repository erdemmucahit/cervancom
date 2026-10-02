import { createTransport, type SMTPTransportOptions } from 'nodemailer';
import { connect } from 'node:tls';

export interface SmtpCredentials {
  SMTP_USER: string;
  SMTP_APP_PASSWORD: string;
}

export interface QuoteEmail {
  to: string;
  replyTo: string;
  text: string;
}

export function smtpOptions(credentials: SmtpCredentials): SMTPTransportOptions {
  return {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    name: 'cervanlojistik.com',
    auth: {
      user: credentials.SMTP_USER,
      // Google displays app passwords in space-separated groups.
      pass: credentials.SMTP_APP_PASSWORD.replace(/\s/g, ''),
    },
    tls: { servername: 'smtp.gmail.com', rejectUnauthorized: true },
    // Let Cloudflare resolve the hostname itself. Nodemailer's pre-resolved
    // IP connection fails in workerd; keep SNI and certificate checks intact.
    getSocket(_options, callback) {
      const socket = connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', rejectUnauthorized: true });
      const timer = setTimeout(() => socket.destroy(new Error('smtp-connect-timeout')), 8000);
      const onError = (error: Error) => {
        clearTimeout(timer);
        socket.removeListener('secureConnect', onConnect);
        socket.destroy();
        callback(error);
      };
      const onConnect = () => {
        clearTimeout(timer);
        socket.removeListener('error', onError);
        callback(null, { connection: socket, secured: true });
      };
      socket.once('error', onError);
      socket.once('secureConnect', onConnect);
    },
    dnsTimeout: 5000,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  };
}

export async function sendQuoteEmail(
  credentials: SmtpCredentials,
  email: QuoteEmail,
  makeTransport = (options: SMTPTransportOptions) => createTransport(options),
) {
  const transport = makeTransport(smtpOptions(credentials));
  try {
    const sent = await transport.sendMail({
      from: { name: 'Cervan', address: credentials.SMTP_USER },
      to: email.to,
      replyTo: email.replyTo,
      subject: 'Cervan | Yeni teklif talebi',
      text: email.text,
      textEncoding: 'base64',
    });
    if (!sent.accepted.some((address) => address.toLowerCase() === email.to.toLowerCase()) ||
        sent.rejected.length || !/^250\b/.test(sent.response)) {
      throw new Error('smtp-not-accepted');
    }
  } finally {
    transport.close();
  }
}
