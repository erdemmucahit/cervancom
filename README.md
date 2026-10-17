# Cervan web sitesi

Astro ve TypeScript ile hazırlanmış, mobil öncelikli kurumsal tanıtım sitesi.

Node sürümü proje kökündeki `.node-version` dosyasında `24.19.0` olarak sabitlenir. Cloudflare Pages'te ayrıca `NODE_VERSION` ortam değişkeni tanımlıysa Production ve Preview için aynı sürümü kullanın; `package.json` içindeki `engines` alanı tek başına Cloudflare'ın Node sürümünü seçmez. Build komutu `npm run build`, çıktı dizini `dist` olmalıdır.

Cloudflare Pages Functions için aktif yapılandırma `wrangler.toml` dosyasıdır. `nodejs_compat` ve compatibility date burada tanımlıdır; yalnızca `.example.jsonc` dosyası otomatik build tarafından kullanılmaz. `npm run check:cloudflare` aynı aktif dosyayla paketleme yapar. Gerçek Hyperdrive binding'i veritabanı kurulumundan sonra bu dosyaya eklenmelidir.

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
- `/cerplus/` — Cerplus depo uygulaması
- `/demo/` — Cerplus ürün sunumu; önceki interaktif operasyon demosu kaldırıldı

## Cerplus · ilk çalışan aşama

Node.js **24+** gerekir. Mevcut site ve teklif formu korunur; **Cerplus’a Giriş** uygulamayı açar. Üretime yayın yapılmamıştır.

İlk kurulum (geliştirme örnekleri, gerçek operasyon verisi değildir):

```bash
npm ci
npm run cerplus:migrate
npm run cerplus:seed
```

İki terminalde, birinde `npm run cerplus:dev`, diğerinde `npm run dev` çalıştırın. Adres: **http://localhost:4321/cerplus/**. Geliştirme hesabı: `admin@cerplus.test` / `CerplusDemo!2026`. Bu hesap yalnızca seed komutuyla oluşturulur; üretimde yoktur. PostgreSQL kurulumu gerekmez; PGlite verileri `.cerplus/development` altında kalıcıdır. Aynı dizini tek API süreci açmalıdır.

Çalışan kapsam: kullanıcı/rol, bayi/bölüm/raf, marka ve çok kolili katalog, standart XLSX aktarımı, barkod/manuel mal kabul, sahipli stok, raf transferi, hasar çıkışı ve işlem geçmişi. Sipariş, randevu, rezervasyon ekranı ve saha sonraki aşamalardır.

```bash
npm test
npm run test:cerplus
npm run test:postgres:local
npm run check:cerplus
npm run check:cloudflare
npm run test:cloudflare
npm run build
npm run test:http
npm run test:dev
```

`test:postgres:local`, yalnızca loopback'te geçici gerçek PostgreSQL başlatır, ayrı test şemaları kullanır ve bitince test verisini temizler. İşletim sistemi süreç başlatma izni gerekebilir. Harici test veritabanı için `CERPLUS_TEST_DATABASE_URL` ve `npm run test:postgres` kullanılır.

Yalnızca Cloudflare hesabı olan kurulumun üretim hedefi **Pages Functions + Hyperdrive + ayrıca yönetilen PostgreSQL**'dir. Bu görevde kaynak açılmaz veya müşteri mesajı gönderilmez. Ayrıntılar: [kurulum](docs/cerplus/README.md), [gereksinimler](docs/cerplus/requirements.md), [mimari](docs/cerplus/architecture.md), [yol haritası](docs/cerplus/roadmap.md), [doğrulama](docs/cerplus/validation.md).
