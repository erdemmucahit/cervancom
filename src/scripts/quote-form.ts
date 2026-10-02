interface Turnstile {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    language: string;
    size: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }): string;
  reset(widgetId: string): void;
}

const form = document.querySelector<HTMLFormElement>('#quote-form');
const status = document.querySelector<HTMLElement>('#quote-status');
const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
const label = form?.querySelector<HTMLElement>('[data-submit-label]');
const verification = document.querySelector<HTMLElement>('#quote-verification');

if (form && status && button && label && verification) {
  const sitekey = form.dataset.sitekey;
  let token = '';
  let submitting = false;
  let widgetId: string | undefined;
  const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  const showStatus = (message: string, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!token) {
      showStatus('Lütfen güvenlik doğrulamasını tamamlayın.', 'error');
      return;
    }
    submitting = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    label.textContent = 'Gönderiliyor…';
    showStatus('Talebiniz gönderiliyor…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const fields = new FormData(form);
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.get('name'), phone: fields.get('phone'), email: fields.get('email'),
          service: fields.get('service'), message: fields.get('message'), website: fields.get('website'), token,
        }),
        signal: controller.signal,
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || result.ok !== true) {
        showStatus(result.message || 'Talebiniz gönderilemedi. Lütfen tekrar deneyin.', 'error');
        return;
      }
      form.reset();
      showStatus('Teklif talebiniz iletildi. En kısa sürede sizinle iletişime geçeceğiz.', 'success');
    } catch {
      showStatus('Gönderim onaylanamadı. Bağlantınızı kontrol edip biraz sonra tekrar deneyin.', 'error');
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
      token = '';
      form.removeAttribute('aria-busy');
      label.textContent = 'Teklif talep et';
      // Turnstile tokens are single-use, including when a later mail request fails.
      if (widgetId !== undefined) turnstile()?.reset(widgetId);
    }
  });

  if (sitekey) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const onVerificationError = () => {
      token = '';
      button.disabled = true;
      if (!submitting) showStatus('Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
    };
    script.onerror = onVerificationError;
    script.onload = () => {
      const api = turnstile();
      if (!api) return onVerificationError();
      widgetId = api.render(verification, {
        sitekey, action: 'quote', language: 'tr',
        size: verification.getBoundingClientRect().width < 300 ? 'compact' : 'flexible',
        callback: (value) => {
          token = value;
          button.disabled = submitting;
          if (!status.dataset.state && !submitting) showStatus('');
        },
        'expired-callback': () => {
          token = '';
          button.disabled = true;
          if (!submitting) showStatus('Lütfen güvenlik doğrulamasını yenileyin.', 'error');
        },
        'error-callback': onVerificationError,
      });
    };
    document.head.append(script);
  }
}
