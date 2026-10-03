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

Form tarayıcıdan Web3Forms'a doğrudan gönderilir. SMTP, Google uygulama şifresi ve Cloudflare mail backend'i kaldırılmıştır. `info@cervanlojistik.com` için oluşturulan Access Key, `.env` ve Cloudflare Pages build ortamında `PUBLIC_WEB3FORMS_ACCESS_KEY` olarak tanımlanır. CAPTCHA kutusu yoktur; görünmez spam alanı bulunur.

Kurulum adımları: [Teklif formu kurulumu](docs/teklif-formu.md).

`npm test` gerçek mail göndermeden formun davranışını kontrol eder. `npm run dev` ile form yerelde kullanılabilir; gerçek anahtarla gönderim gerçek mail yollar. Web3Forms'un ücretsiz kotası ayda 250 gönderimdir.

## Sayfalar

- `/` — Ana sayfa
- `/hakkimizda` — Hakkımızda
- `/hizmetler` — Hizmetler
- `/iletisim` — İletişim ve teklif formu
