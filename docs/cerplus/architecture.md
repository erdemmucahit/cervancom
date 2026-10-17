# Cerplus mimarisi

## Mevcut proje ve karar

İnceleme başlangıcı: Astro 7 + TypeScript, statik çıktı; `npm run build` → `dist`. Kurumsal site/operasyon demosu korunur. Teklif formu Web3Forms'a doğrudan gönderilir; önceki projede backend veya kimlik sistemi yoktur. README Cloudflare Pages dağıtımını tarif eder. Kullanıcı yalnızca Cloudflare hesabı bulunduğunu doğruladı.

Seçim: TypeScript modüler tek uygulama + PostgreSQL; üretim HTTP adaptörü Cloudflare Pages Functions. Astro `/cerplus/` arayüzünü üretir; `cerplus/` modülleri standart Request/Response, kimlik, katalog, depo ve aktarımı içerir. `functions/cerplus/api/[[path]].ts` aynı uygulamayı Hyperdrive üzerinden PostgreSQL'e bağlar. Geliştirmede Astro `/cerplus/api` isteklerini yerel Node adaptörüne yönlendirir. `cerplus:serve` komutu derlenmiş site ve API'yi aynı yerel Node sürecinde test etmek içindir. Mikroservis veya ayrı bir Node sunucusu kiralama zorunluluğu yoktur. Gerekirse `PUBLIC_CERPLUS_URL` ayrı uygulama alan adını destekler.

PostgreSQL ilişkiler, miktar kısıtları, işlemler, satır kilitleri ve eşzamanlı rezervasyon için seçildi. `pg` üretim sürücüsüdür. Kurulu PostgreSQL/Docker bulunmadığından yerel geliştirme ve hızlı testlerde PGlite (WebAssembly içinde gerçek PostgreSQL) kullanılır; aynı SQL migration'larını çalıştırır, ayrı disk dizinine kaydeder. SQLite veya tarayıcı localStorage stok veritabanı değildir. PGlite tek bağlantı ve tek süreç içindir; üretimde yasaktır. PostgreSQL çok bağlantılı entegrasyon testi ayrı komutla çalıştırılır; PGlite testi onun yerine geçmiş sayılmaz.

## Hosting uyumu

Cloudflare Pages statik siteyi, Pages Functions API'yi barındırır. Kalıcı Node HTTP süreci veya PGlite dosya sistemi üretimde kullanılmaz. `pg` + Hyperdrive resmi olarak desteklenir; `node:crypto` scrypt ve `node:zlib` Node uyumluluğuyla çalışır. ExcelJS'nin tarayıcı paketi dosya sistemi/archiver bağımlılıklarını üretim paketinden çıkarır. Functions paketi Wrangler ile yerelde derlenir; PGlite/WASM bu pakete girmez. Yerel workerd smoke testi scrypt ve gerçek XLSX üretme/okuma/ZIP doğrulamasını da çalıştırır; bu test hesap kotasını veya gerçek Hyperdrive bağlantısını doğrulamaz. `public/_routes.json` yalnızca `/cerplus/api/*` yolunu Function'a gönderir; bilgi sitesi statik kalır.

Cloudflare hesabı tek başına PostgreSQL veritabanı sağlamaz. Üretim için ayrıca yönetilen PostgreSQL (17+), Hyperdrive binding'i, migration ve ilk admin kurulumu gerekir. `wrangler.cerplus.example.jsonc` yalnızca yapılandırma örneğidir; gerçek kaynak kimliği içermez. Hyperdrive sorgu önbelleği **kapatılmalıdır**: oturum iptali, yetki ve stok okumaları eski veri kabul etmez. Worker CPU/bellek kotası özellikle scrypt ve XLSX ayrıştırması için gerçek planda ölçülmeden ücretsiz plan yeterli sayılmaz. Bu görevde ücretli hesap, kaynak veya dağıtım oluşturulmaz. Eksik binding'de API açık 503 verir; çalışıyor gibi davranmaz.

Kaynaklar (17 Ekim 2026 incelemesi): [Pages Functions](https://developers.cloudflare.com/pages/functions/), [Hyperdrive ve PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/), [önbelleğin kapatılması](https://developers.cloudflare.com/hyperdrive/get-started/), [Workers crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/), [PGlite kalıcılık](https://pglite.dev/docs/filesystems), [pg işlemleri](https://node-postgres.com/features/transactions), [ExcelJS](https://github.com/exceljs/exceljs). Uzak hesap/Cloudflare paneli incelenmedi; uyumluluk resmi belgeler ve yerel paketleme ile değerlendirildi. Gerçek Hyperdrive/veritabanı bağlantısı ayrıca doğrulanmalıdır.

## Veri modeli

İlk migration: `app_meta`, `dealers`, `users`, `sessions`, `login_attempts`, `brands`, `products`, `package_types`, `sections`, `racks`, `receipts`, `receipt_lines`, `stock`, `stock_movements`, `import_previews`, `audit_log`.

- Kimlikler UUID, zamanlar timestamptz/UTC; gösterim Europe/Istanbul. Miktarlar tamsayı, m³/kg PostgreSQL numeric. Sonraki para alanları BIGINT kuruş; JSON'da ondalık metin veya güvenli sınır doğrulaması.
- `products`: marka/kod/varyant benzersiz. `package_types`: ürün, sıra, toplam tip sayısı, gerekli adet, barkod, m³ ve kg; marka/barkod benzersiz. Katalog tüm koli sırasını doğrular. Kullanılmış koli tanımı sessizce değişmez.
- `stock`: raf, koli tipi, sahip anahtarı (`common` veya bayi UUID). Fiziksel >= rezerve + korunmuş >= 0. Ortak/bayi ayrımı CHECK ve yabancı anahtarla doğrulanır. Depo ilk sürümde tektir; bölüm ve raflar bu depoya aittir.
- Kabuller: benzersiz tekrar anahtarı + belge numarası + sahip + satırlar. XLSX içeriğinin normalize edilmiş özeti tekrar yüklemeyi engeller. Manuel okutma gerçek yeni kolidir; aynı ekranda miktarı artırır, yalnızca aynı gönderim anahtarı çift kaydı engeller.
- Transfer/hasar: kullanılabilir miktar üzerinden koşullu atomik azaltma, transferde hedef artırma ve hareket/audit aynı işlemde. Hasar stoğu kullanılabilirden çıkarır; geçmiş hareket kalır.
- `audit_log`: actor, action, entity, before/after JSONB, timestamp. Parolalar/oturum sırları kaydedilmez. Düzenlenebilir audit API'si yoktur.

Sonraki migration'lar: orders/order_items (bayi + no), allocation_plans/decisions, incomplete_protections (koşul özeti), reservations/reservation_lines, deliveries/delivery_items, invitation_tokens/appointments, teams/vehicles/trips/stops/picking_lines, delivery_results/service_cases/dealer_decisions, private_files/return_receipts, outbox/provider_events. Henüz kullanılmayan tablolar ve sahte operasyonlar eklenmez.

## İşlem ve eşzamanlılık sınırı

Her stok değişikliği transaction'dır. Kullanılabilirden ayırma `UPDATE ... WHERE physical-reserved-protected >= qty RETURNING ...` kullanır; birden çok satır sabit kimlik sırasıyla işlenir ve herhangi biri başarısızsa hepsi geri alınır. Gerçek PostgreSQL'de aynı satıra eşzamanlı UPDATE kilidi koşulu yeniden değerlendirir. PGlite adapter'i transaction'ları sıraya alır. Kesin rezervasyon üst iş akışı aşama 2'de eklenir; şimdiden miktar kısıtları ve çekirdek yarış testi vardır.

Excel önizlemesi kullanıcıya bağlı, süreli veritabanı kaydıdır. Onayda satırlar tekrar doğrulanır; önizleme kilitlenir, digest benzersizliği aynı transaction içinde tekrar kontrol edilir. Bütün satırlar ve hareketler birlikte commit edilir. Sunucu dosya/ZIP açılmış boyut, satır sayısı ve tip kısıtları uygular; formül, parola korumalı/bozuk dosya ve uyuşmayan şablon reddedilir.

## Kimlik ve yetkiler

| Rol | İlk aşama |
| --- | --- |
| Admin | Tüm stok/katalog/aktarım, bayi/bölüm/raf, kullanıcı oluşturma-kapatma |
| Operasyon | Katalog, mal kabul, transfer/hasar, stok/hareket okuma |
| Bayi | Yalnızca kendi stok ve hareketlerini okuma; katalog salt okunur |
| Ekip | Hesabına giriş/parola değişikliği; saha işleri aşama 4'te |

Oturum rastgele 256-bit token; veritabanında SHA-256 özeti, HttpOnly/SameSite=Strict cookie, üretimde Secure. Mutasyonlarda Origin allowlist + oturuma bağlı CSRF token gerekir. Parolalar tuzlu scrypt; giriş denemeleri veritabanında IP/hesap özeti ile sınırlanır. Oturum 8 saat; kapatılan kullanıcı anında reddedilir; parola değişimi oturumları iptal eder. Üretimde proxy yalnızca belirtilen origin'den yayınlar; X-Forwarded-For'a güvenilmez. SQL parametrelidir. Her endpoint rol ve bayi kapsamını sunucuda denetler; farklı bayi kaynakları 404. Yanıtlar no-store, nosniff; Cerplus noindex ve CSP ile sunulur. Özel dosyalar ileride kimlik denetimli endpoint üzerinden verilir, public içine yazılmaz.

## Entegrasyon sınırları

Bildirim, rota ve takip sağlayıcıları arayüz/adaptor ve outbox üzerinden eklenecek; henüz gerçek sağlayıcı yoktur. ExcelJS yalnızca standart XLSX okuyucu/yazıcısıdır; özel marka sütunlarını iş kuralından ayrı eşleyeceğiz. Barkod okuyucu Enter sonlandıran klavye girdisidir; cihaza özel SDK yoktur. İade onayı modülü inventory artıramaz; yalnız fiziksel kontrol/kabul servisi hareket üretebilir. Dosya deposu nesne anahtarı ve yetkili erişimle sınırlanacaktır.
