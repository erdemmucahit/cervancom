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

Form arayüzü ve doğrulaması hazırdır. Canlı talep gönderimi için Cloudflare Worker üzerinde bir API endpoint’i ile Google Workspace Gmail API yetkilendirmesi eklenecek. Bu aşamada OAuth istemci bilgileri ve yenileme belirteci yalnızca Cloudflare gizli değişkenleri olarak tanımlanmalıdır; kaynak koda eklenmemelidir.

## Sayfalar

- `/` — Ana sayfa
- `/hakkimizda` — Hakkımızda
- `/hizmetler` — Hizmetler
- `/iletisim` — İletişim ve teklif formu
