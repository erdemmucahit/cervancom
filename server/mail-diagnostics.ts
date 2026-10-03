// Provider messages can contain addresses or credentials. Log only known codes.
export function mailDiagnostics(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const codes = new Set([
    'EAUTH', 'ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'EDNS', 'ENOTFOUND',
    'ECONNREFUSED', 'ECONNRESET', 'EENVELOPE', 'EMESSAGE', 'ESTREAM',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  ]);
  const commands = new Set(['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH', 'AUTH PLAIN', 'AUTH LOGIN', 'MAIL FROM', 'RCPT TO', 'DATA']);
  // Translate exact known messages to fixed labels; never echo raw messages.
  const reason = value.message === 'smtp-connect-timeout' ? 'TLS_CONNECT_TIMEOUT'
    : value.message === 'smtp-tcp-connect-timeout' ? 'TCP_CONNECT_TIMEOUT'
    : value.message === 'Greeting never received' ? 'SMTP_GREETING_TIMEOUT' : undefined;
  return {
    code: typeof value.code === 'string' && codes.has(value.code) ? value.code
      : value.name === 'TimeoutError' ? 'ETIMEDOUT' : 'UNKNOWN',
    ...(typeof value.responseCode === 'number' && Number.isInteger(value.responseCode)
      && value.responseCode >= 400 && value.responseCode <= 599 ? { responseCode: value.responseCode } : {}),
    ...(typeof value.command === 'string' && commands.has(value.command) ? { command: value.command } : {}),
    ...(reason ? { reason } : {}),
  };
}
