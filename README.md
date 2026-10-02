# Cervan web sitesi

Astro ve TypeScript ile hazırlanmış, mobil öncelikli kurumsal tanıtım sitesi.

## Yerel çalışma

```bash
npm install
npm run dev
```

Üretim derlemesi için:

```bash
npm run build
```

## İçerik yapılandırması

Firma adı, hizmet bölgesi, adres, telefon, e-posta ve WhatsApp bilgileri `src/config/site.ts` dosyasında bulunur. Yayına çıkmadan önce `contact` alanındaki değerleri güncelleyin.

## Teklif formu

Form, Cloudflare Pages Function olan `/api/quote` üzerinden Google Workspace SMTP ile `info@cervanlojistik.com` adresine teklif e-postası gönderir. SMTP bağlantısı `smtp.gmail.com:465` üzerinden TLS ile kurulur. Google hesabının uygulama şifresi ve Turnstile ayarları canlı gönderim için gereklidir. Google Cloud projesi veya OAuth istemcisi gerekmez.

Kurulum adımları: [Teklif formu kurulumu](docs/teklif-formu.md).

```bash
npm test
```

Testler dış servislere bağlanmaz ve gerçek e-posta göndermez. `npm run dev` yalnızca Astro arayüzünü çalıştırır; API ile yerel deneme için kurulum belgesindeki Cloudflare komutlarını kullanın.

## Sayfalar

- `/` — Ana sayfa
- `/hakkimizda` — Hakkımızda
- `/hizmetler` — Hizmetler
- `/iletisim` — İletişim ve teklif formu
