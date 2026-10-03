const form = document.querySelector<HTMLFormElement>('#quote-form');
const status = document.querySelector<HTMLElement>('#quote-status');
const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
const label = form?.querySelector<HTMLElement>('[data-submit-label]');

if (form && status && button && label) {
  let submitting = false;
  const showStatus = (message: string, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const accessKey = form.querySelector<HTMLInputElement>('input[name="access_key"]')?.value.trim();
  button.disabled = !accessKey;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!accessKey) {
      showStatus('Teklif formu şu anda kullanılamıyor. Bize e-posta ile ulaşabilirsiniz.', 'error');
      return;
    }
    const fields = new FormData(form);
    if (fields.has('botcheck')) {
      showStatus('Talep gönderilemedi. Lütfen sayfayı yenileyip tekrar deneyin.', 'error');
      return;
    }
    const payload = {
      access_key: accessKey, subject: fields.get('subject'), from_name: fields.get('from_name'),
      name: fields.get('name'), phone: fields.get('phone'), email: fields.get('email'),
      service: fields.get('service'), message: fields.get('message'), botcheck: false,
    };
    submitting = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    label.textContent = 'Gönderiliyor…';
    showStatus('Talebiniz gönderiliyor…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const result = await response.json() as { success?: boolean };
      if (!response.ok || result.success !== true) {
        showStatus(response.status === 429
          ? 'Şu anda gönderim sınırına ulaşıldı. Lütfen biraz sonra tekrar deneyin veya bize e-posta gönderin.'
          : 'Talebiniz gönderilemedi. Lütfen tekrar deneyin veya bize e-posta gönderin.', 'error');
        return;
      }
      form.reset();
      showStatus('Teklif talebiniz iletildi. En kısa sürede sizinle iletişime geçeceğiz.', 'success');
    } catch {
      showStatus('Gönderim sonucu alınamadı. Biraz sonra tekrar deneyebilir veya bize e-posta gönderebilirsiniz.', 'error');
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
      label.textContent = 'Teklif talep et';
    }
  });
}
