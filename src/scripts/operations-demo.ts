// This presentation runs entirely in memory. Reloading or resetting clears it.
const root = document.querySelector<HTMLElement>('[data-demo]');

if (root) {
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Demo element missing: ${selector}`);
    return element;
  };
  const received = new Set<number>();
  const products = ['Luna üçlü koltuk', 'Luna berjer', 'Meşe orta sehpa'];
  const statuses = ['Ürünler bekleniyor', 'Randevu bekleniyor', 'Sevkiyat planlanıyor', 'Dağıtımda', 'Teslimat adresinde', 'Teslim edildi'];
  let unlocked = 0;
  let journey = 0;
  let photos = false;
  let signature = false;
  let appointment = '';
  let vehicle = '';
  let driver = '';

  const event = (type: string, title: string, message: string) => {
    const list = get<HTMLOListElement>('[data-events]');
    if (!received.size && unlocked === 0) list.replaceChildren();
    const item = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'demo-event-type';
    badge.textContent = type;
    const content = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = message;
    content.append(heading, body);
    const state = document.createElement('span');
    state.className = 'demo-event-state';
    state.textContent = 'Önizleme';
    item.append(badge, content, state);
    list.prepend(item);
  };

  const show = (step: number, focus = true) => {
    if (step > unlocked) return;
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => {
      panel.hidden = Number(panel.dataset.panel) !== step;
    });
    root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => {
      const index = Number(button.dataset.step);
      button.disabled = index > unlocked;
      button.classList.toggle('is-current', index === step);
      button.classList.toggle('is-done', index < unlocked || unlocked === 5);
      if (index === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.querySelector('.demo-step-check')!.textContent = index < unlocked || unlocked === 5 ? '✓' : '';
    });
    if (focus) {
      const heading = get(`[data-panel="${step}"] h3`);
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };

  const advance = (step: number) => {
    unlocked = step;
    get('[data-order-status]').textContent = statuses[step];
    show(step);
  };

  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => {
    button.addEventListener('click', () => show(Number(button.dataset.step)));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-receive]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.receive);
      if (received.has(index)) return;
      event('E-POSTA', 'Bayiye ürün kabul bildirimi', `${products[index]} depoya alındı ve kontrol edildi. Alıcı: Örnek Mobilya.`);
      received.add(index);
      button.disabled = true;
      button.textContent = 'Kabul edildi ✓';
      button.closest('.demo-product')?.classList.add('is-received');
      get('[data-count]').innerHTML = `${received.size} <small>/ 3 ürün</small>`;
      get('[data-order-status]').textContent = received.size === 3 ? statuses[1] : 'Ürün kabulü sürüyor';
      if (received.size === 3) {
        unlocked = 1;
        get<HTMLButtonElement>('[data-next]').disabled = false;
        get('[data-inbound-note]').textContent = 'Sipariş eksiksiz hazır. Müşteri için örnek randevu bağlantısı oluşturuldu.';
        event('SMS + E-POSTA', 'Siparişiniz hazır, randevunuzu seçin', 'Deniz Hanım, 3 ürününüz depomuzda hazır. Örnek müşteri portalından teslimat gününüzü seçebilirsiniz.');
        show(0, false);
      }
    });
  });
  get('[data-next]').addEventListener('click', () => show(1));

  get<HTMLFormElement>('[data-schedule-form]').addEventListener('submit', e => {
    e.preventDefault();
    if (unlocked !== 1) { show(2); return; }
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const day = new Date(`${form.get('date')}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    appointment = `${day} · ${form.get('slot')}`;
    get('[data-date-summary]').textContent = appointment;
    get('[data-calendar-date]').textContent = appointment;
    event('SMS + E-POSTA', 'Teslimat randevusu onaylandı', `${appointment}. Adres: Çankaya, Ankara.`);
    (e.currentTarget as HTMLFormElement).querySelectorAll<HTMLInputElement>('input').forEach(input => input.disabled = true);
    advance(2);
  });

  get<HTMLFormElement>('[data-fleet-form]').addEventListener('submit', e => {
    e.preventDefault();
    if (unlocked !== 2) { show(3); return; }
    const form = new FormData(e.currentTarget as HTMLFormElement);
    vehicle = String(form.get('vehicle'));
    driver = String(form.get('driver'));
    get('[data-vehicle-summary]').textContent = vehicle;
    get('[data-tracking-team]').textContent = `${vehicle} · ${driver}`;
    event('SMS', 'Siparişiniz yola çıktı', `${vehicle} plakalı araç teslimat için yola çıktı. Müşteri takip ekranı hazır. Tahmini yolculuk: 45 dakika.`);
    (e.currentTarget as HTMLFormElement).querySelectorAll('select').forEach(select => select.disabled = true);
    advance(3);
  });

  const positions = [[85, 70], [220, 102], [345, 155], [530, 215]];
  get<HTMLButtonElement>('[data-move]').addEventListener('click', () => {
    if (journey === 3) { show(4); return; }
    journey++;
    const [x, y] = positions[journey];
    get('[data-truck]').setAttribute('transform', `translate(${x} ${y})`);
    get('[data-eta]').textContent = ['45 dakika', '30 dakika', '15 dakika', 'Adresinize ulaştı'][journey];
    get('[data-distance]').textContent = `${[0, 14, 28, 42][journey]} / 42 km`;
    if (journey === 3) {
      unlocked = 4;
      get('[data-order-status]').textContent = statuses[4];
      get('[data-tracking-note]').textContent = 'Ekip adrese ulaştı. Teslimat ve montaj başlayabilir.';
      get('[data-move]').textContent = 'Teslimat ekranına geç →';
      event('SİSTEM', 'Ekip teslimat adresinde', 'Örnek yolculuk tamamlandı. Teslimat kanıtları bekleniyor.');
      show(3, false);
    }
  });

  const updateProof = () => {
    get<HTMLButtonElement>('[data-complete]').disabled = !(photos && signature && get<HTMLInputElement>('[data-install]').checked);
  };
  get<HTMLButtonElement>('[data-photo]').addEventListener('click', e => {
    photos = true;
    get('[data-photo-preview]').classList.add('has-proof');
    get('[data-photo-preview]').innerHTML = '<span aria-hidden="true">✓</span><p>3 örnek fotoğraf eklendi<br /><small>Koltuk · Berjer · Sehpa</small></p>';
    const button = e.currentTarget as HTMLButtonElement;
    button.textContent = 'Örnek fotoğraflar eklendi ✓';
    button.disabled = true;
    updateProof();
  });
  get<HTMLButtonElement>('[data-sign]').addEventListener('click', e => {
    signature = true;
    get('[data-signature-preview]').classList.add('has-proof');
    const button = e.currentTarget as HTMLButtonElement;
    button.textContent = 'Örnek imza eklendi ✓';
    button.disabled = true;
    updateProof();
  });
  get('[data-install]').addEventListener('change', updateProof);
  get('[data-complete]').addEventListener('click', () => {
    if (unlocked !== 4 || !photos || !signature || !get<HTMLInputElement>('[data-install]').checked) return;
    get('[data-report-date]').textContent = appointment;
    get('[data-report-team]').textContent = `${vehicle} / ${driver}`;
    get<HTMLInputElement>('[data-install]').disabled = true;
    get<HTMLButtonElement>('[data-complete]').disabled = true;
    event('E-POSTA', 'Bayi teslimat raporu hazır', 'Örnek Mobilya: CVN-2026-1042 tamamlandı. 3 ürün teslim edildi; örnek fotoğraflar, müşteri imzası ve montaj onayı rapora eklendi.');
    advance(5);
  });
  root.querySelectorAll('[data-reset], [data-restart]').forEach(button => button.addEventListener('click', () => window.location.reload()));
  show(0, false);
}
