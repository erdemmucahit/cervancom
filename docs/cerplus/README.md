# Cerplus çalışma talimatı

## Yerel başlangıç

Node 24+ ile proje kökünde `npm ci`, `npm run cerplus:migrate`, isteğe bağlı `npm run cerplus:seed` çalıştırın. Bir terminalde `npm run cerplus:dev`, diğerinde `npm run dev` çalıştırın. **http://localhost:4321/cerplus/** adresini açın. Astro varsayılan portu doluysa farklı port seçebilir; bu durumda `CERPLUS_ORIGIN` değerini tam görünen origin'e değiştirip API'yi yeniden başlatın. `localhost` ve `127.0.0.1` farklı origin'dir.

`.env.example` Cerplus değişkenlerini listeler; mevcut `.env` içeriğinin üstüne yazmayın. `DATABASE_URL` boşsa PGlite `.cerplus/development` kullanılır. Bu dizin Git'e girmez. API açılmadan önce migration gerekir; uygulama her açılışta sessizce şema değiştirmez. Tek PGlite dizinine iki süreç bağlamayın; CLI çalıştırırken API'yi kapatın.

| Geliştirme hesabı | Rol |
| --- | --- |
| admin@cerplus.test | Admin |
| ofis@cerplus.test | Depo/ofis operasyonu |
| ekip@cerplus.test | Saha (iş modülü henüz açılmadı) |
| bayia@cerplus.test | Yalnız Örnek Bayi A |
| bayib@cerplus.test | Yalnız Örnek Bayi B |

Seed hesaplarının parolası `CerplusDemo!2026`. Bunlar yalnızca boş geliştirme veritabanına yüklenir. Geliştirme verisi bayrağı arayüzde sürekli görünür; üretim adaptörü bu veritabanını reddeder. Seed tekrarı veri çoğaltmaz, mevcut gerçek verinin üzerine yazmaz. Örnek GRD-15 gardropta A bayisinin toplam 15 kolisi bulunur ama 15-15 tipi eksiktir. B bayisinin bu tipi A bayisinin açığını kapatmaz. İki örnek markadaki 15-01 barkodu belirsizlik akışını denemek içindir.

Derlenmiş siteyi tek yerel süreçten denemek için API'yi kapatın, `npm run build` çalıştırın. PowerShell'de `$env:CERPLUS_ORIGIN='http://localhost:4322'` ayarlayıp `npm run cerplus:serve` çalıştırın. **http://localhost:4322/cerplus/** kullanın. Sonra geliştirme için origin'i tekrar `http://localhost:4321` yapın.

## İlk kullanım

1. Admin ile Yönetim → Bayiler / Markalar / Bölüm ve raflar tanımlarını oluşturun. Raf kapasitesi isteğe bağlı m³ değeridir; fiziksel sığma garantisi değildir. Dolu raf kapatılamaz. Boş raf kapatılır; geçmiş hareketler saklanır.
2. Yönetim → Kullanıcılar'dan kullanıcı oluşturun. Bayi rolü bir bayiye bağlı olmalıdır. Hesabı kapatma tüm oturumlarını iptal eder; kendi hesabınızı bu ekrandan kapatamazsınız. Parolalar 12–128 karakter; kullanıcı üst çubuktan kendi parolasını değiştirir. Otomatik parola sıfırlama e-postası bu aşamada yoktur.
3. Katalog → Ürün ekle ile tüm gerekli koli tiplerini tanımlayın veya şablonu indirip Excel'den aktarın. Katalog ekleme fiziksel stok yaratmaz. Yanlış ürün tanımını sessizce değiştiren bir işlem bu aşamada yoktur; mevcut ürün/barkod tekrarları hata verir.
4. Mal kabul → sahibi, belge no, raf ve marka bağlamını seçin; barkodu yazıp Enter'a basın veya klavye gibi çalışan terminalle okutun. Tekrar okutma miktarı artırır. Marka belirtilmeden birden fazla eşleşme bulunursa seçim gerekir; tanımsız barkod sepete alınmaz. Kabulü onayla stok ve hareketleri birlikte kaydeder. Sepet sunucuya onaylanana kadar geçicidir; sayfayı kapatmak kaydedilmemiş sepeti kaybettirir.
5. Stok görünümü → İşlem ile kullanılabilir miktardan raf transferi veya gerekçeli hasar çıkışı yapın. Stok sahibi değiştirilemez; rezerve/korunan miktar tüketilemez. Bayi hesabı bu işlemleri yapamaz.

## Standart Excel

Yalnızca `.xlsx`, tek çalışma sayfası, en fazla 2 MB sıkıştırılmış / 8 MB açılmış, 1000 veri satırı. Şablon örnek satır içerir; bu satırı kendi verinizle değiştirin. Eski `.xls` dosyasını Excel'de `.xlsx` olarak kaydedin. Gerçek marka dosyaları henüz sağlanmadığı için özel sütun eşleştiricisi yoktur.

Katalog başlıkları tam bu sırada:

```text
urun_kodu | model | varyant | koli_sira | toplam_koli | gereken_adet | barkod | hacim_m3 | agirlik_kg | montaj_dakika
```

Marka dosya dışında seçilir. Aynı ürün kodu + varyantın tüm koli sıraları 1'den toplam sayıya kadar bulunmalı; gereken adet her tipten bir ürüne kaç koli gerektiğidir. Hacim/ağırlık sıfırdan büyük, en fazla altı ondalıktır. Montaj dakika alanı 0–1440 arasıdır. Örneğin 15 tip için aynı ürün koduyla 15 satır.

Mal kabul başlıkları:

```text
barkod | raf | miktar
```

Marka, sahip ve belge no ekrandan seçilir. Barkod/ürün kodu/raf metin hücresi olmalı; Excel'de sayıya dönüşmüş barkodun kaybolmuş sıfırlarını sistem tahmin etmez. Formül, bağlantılı hücre, zengin metin ve makro desteklenmez. Şablondan farklı başlık reddedilir.

Önizleme stok/katalog değiştirmez. Satır bazında hata varsa dosyayı düzeltip tekrar önizleyin; hatalı dosyanın sağlam satırları da kaydedilmez. Önizleme kullanıcıya bağlı ve 30 dakika geçerlidir. Onayda veriler yeniden kontrol edilir. Normalize edilmiş aynı içerik yeniden yüklenirse eski sonuç döner; dosya adını değiştirmenin etkisi yoktur. Gerçek ayrı bir aynı-miktarlı mal kabul için farklı gerçek belge no kullanılmalıdır. Manuel kabulde aynı gönderimin tekrarına karşı ayrı anahtar kullanılır; gerçek tekrar okutma mükerrer sayılmaz.

Stok görünümü en fazla 500 satır, katalog 200 ürün, hareketler 200 kayıt, audit 100 kayıt gösterir. Ekran özetleri görüntülenen stok satırlarını kapsar. Geniş rapor/export ve sayfalama sonraki aşamada geliştirilecektir.

## Gerçek PostgreSQL ve migration

`DATABASE_URL` verilirse aynı migration ve servisler `pg` üzerinden gerçek PostgreSQL'e bağlanır. Uzak bağlantıda sağlayıcının sertifika/TLS gereksinimlerini kullanın; sertifika denetimi kapatılmaz. PGlite dosyası üretime kopyalanmaz.

Boş operasyon veritabanı oluşturulduktan sonra `CERPLUS_MODE=production`, `DATABASE_URL`, `CERPLUS_ADMIN_NAME`, `CERPLUS_ADMIN_EMAIL`, `CERPLUS_ADMIN_PASSWORD` değişkenlerini güvenli yerel ortamda belirleyin. Ardından `npm run cerplus:migrate` ve `npm run cerplus:admin` çalıştırın. İlk admin komutu yalnızca kullanıcı tablosu boşsa çalışır. Parola değişkenini işiniz bitince ortamdan kaldırın; kaynak koda veya komut satırı argümanına yazmayın. Üretimde seed komutunu çalıştırmayın.

Migration checksum'ları saklanır; uygulanmış SQL dosyasını değiştirmeyin, yeni numaralı dosya ekleyin. Migration aracı 001 için basit noktalı virgül ayrımı kullanır; PL/pgSQL fonksiyon gövdesi gereken sonraki migration'dan önce SQL yürütücüsü genişletilmelidir. Yedekleme/geri yükleme yönetilen sağlayıcıda ayrıca kurulmalıdır.

## Cloudflare üretim yolu (henüz yayınlanmadı)

Build ortamı Node `24.19.0` kullanmalıdır; proje kökündeki `.node-version` bunu belirtir. Cloudflare Pages ayarlarında `NODE_VERSION` zaten tanımlıysa Production ve Preview değerlerini `24.19.0` yapın veya dosyadaki sürümün seçilmesi için eski değişkeni kaldırın. `engines.node` alanı build ortamındaki sürümü kendiliğinden yükseltmez. Logda `Node.js v22.16.0 is not supported by Astro` görünmesi bu ayarın eksik/eski olduğunu gösterir; üstteki npm `deprecated` uyarıları bu hatanın sebebi değildir. Build komutu `npm run build`, çıktı `dist` olarak kalır. [Cloudflare build sürümü seçimi](https://developers.cloudflare.com/pages/configuration/build-image/).

Kullanıcının yalnız Cloudflare hesabı vardır. Ayrı Node sunucusu yerine mevcut Pages projesine Functions eklenir. Üretim için şunlar ayrıca kurulmalıdır:

1. Yönetilen PostgreSQL 17+ hesabı/veritabanı ve yedekleme; bunlar Cloudflare hesabıyla kendiliğinden oluşmaz.
2. PostgreSQL'i bağlayan `HYPERDRIVE` binding'i. **Hyperdrive query caching kapalı olmalıdır.** Stok, kullanıcı yetkisi ve oturum iptali eski önbellekten okunamaz. [Resmi Hyperdrive kurulumu](https://developers.cloudflare.com/hyperdrive/get-started/).
3. Aktif yapılandırma `wrangler.toml`: `CERPLUS_ORIGIN` tam HTTPS adresi, `nodejs_compat` ve compatibility date burada tanımlıdır. Gerçek `HYPERDRIVE` binding kimliğini bu dosyadaki açıklamalı bölümü etkinleştirerek ekleyin. `wrangler.cerplus.example.jsonc` yalnızca alternatif biçim örneğidir; otomatik kullanılmaz. Aktif Wrangler dosyası Pages yapılandırmasının kaynağıdır: panelde daha önce tanımlanmış başka kaynak binding'leri varsa bunları da gerçek kimlikleriyle dosyaya taşıyın. Build ortam değişkenlerini ve secret değerleri kaynak koda yazmayın.
4. Güvenli bağlantıyla migration ve ilk admin bootstrap'i. Uygulama veritabanı kullanıcısı DDL yetkisiz, tablo DML yetkili ayrı rol olmalıdır; migration hesabı ayrı tutulmalıdır.
5. `npm run build`, `npm run check:cloudflare`; mevcut Pages build komutu `npm run build`, çıktı `dist`. Repodaki `functions/` Pages tarafından ayrıca derlenir. `_routes.json` yalnız Cerplus API yolunu dinamik çalıştırır; bilgi sitesi/Web3Forms aynı davranışı sürdürür.
6. Gerçek planda scrypt giriş ve XLSX CPU/bellek ölçümü, binding + PostgreSQL ile smoke test, tarayıcı/terminal ve duyarlı ekran doğrulaması. Ücretsiz Worker kotasının yeterli olduğu varsayılmamalıdır. Ücretli plan açma ayrıca talimat gerektirir.

İlk dağıtım bu görevde yapılmamıştır. Binding yoksa API 503 ve açık kurulum mesajı döner. Henüz gerçek SMS, WhatsApp/Telegram, harita veya takip bağlantısı yoktur. İlgili özel dosya/randevu endpoint'leri yoktur; bunlar yol haritasındaki aşamalarda gerçek yetki kontrolüyle eklenecektir.

## Test komutları

- `npm test`: mevcut teklif formunun 5 regresyon kontrolü; gerçek mail göndermez.
- `npm run test:cerplus`: izole bellek PGlite veritabanında 15 temel test.
- `npm run test:postgres:local`: geliştirme bağımlılığındaki gerçek PostgreSQL 18'i yalnız `127.0.0.1` üzerinde geçici başlatır; aynı 15 test + iki bağımsız bağlantılı kilit/yarış testini çalıştırır; kapanınca kendi geçici dizinini temizler. Sistem servisi veya işletim sistemi kullanıcısı oluşturmaz. Windows Türkçe locale için test cluster'ı C/UTF8 kullanır.
- `CERPLUS_TEST_DATABASE_URL` + `npm run test:postgres`: sizin ayırdığınız test veritabanında benzersiz geçici şemayla gerçek kilit/yarış testi. `DATABASE_URL` bu testte kullanılmaz.
- `npm run check:cerplus`: sunucu, Functions, test ve arayüz TypeScript kontrolü.
- `npm run check:cloudflare`: Pages CI'nin proje ve build metadata seçenekleriyle aktif `wrangler.toml` dosyasını okuyarak yerel Worker paketler; yayın/hesap bağlantısı yapmaz. Uyumluluk bayrakları ayrıca CLI'den verilmez, dosyadan alınır.
- `npm run test:cloudflare`: önce `check:cloudflare` çalıştırın. Yerel workerd ortamında aktif yapılandırmayla scrypt/ExcelJS uyumluluğunu ve gerçek Pages paketinin yüklenmesini doğrular. Eksik veritabanı binding'inde kontrollü 503 beklenir; gerçek Hyperdrive bağlantısı veya hesap kotası sınanmaz.
- `npm run build`: mevcut site ve Cerplus arayüzü.
- `npm run test:http`: build sonrasında ayrı geçici geliştirme veritabanı ve gerçek yerel HTTP süreciyle sayfa/JS, giriş, oturum, mal kabul, mükerrer koruması, hareket ve çıkış kontrolü. İşlem sonunda test süreci ve verisi temizlenir.
- `npm run test:dev`: Astro geliştirme sunucusu ve ayrı Cerplus API sürecini birlikte açarak aynı giriş/stok/şablon/mal kabul akışını proxy üzerinden kontrol eder. Mevcut terminal süreçlerinizi kullanmaz; ayrı portlar ve geçici test verisiyle çalışır.

API istemcisi `trailingSlash: 'always'` ayarı için `/cerplus/api/login/` gibi sonu `/` ile biten adresler üretir. Sorgu parametreleri eğik çizgiden sonra gelir: `/cerplus/api/stock/?search=...`. Astro geliştirme sunucusu bu biçime uymayan isteği Vite proxy'sinden önce 404 ile reddedebilir. Bağlantı kontrolü için `http://localhost:4321/cerplus/api/health/` kullanın.

Sipariş aktarımı, tam ürün rezervasyon iş akışı, özel dosyalar ve fiziksel iade kabulü henüz uygulanmadı. Tam takım ve stok talep çekirdeği testleri bu sonraki akışların tamamını doğrulamış sayılmaz.
