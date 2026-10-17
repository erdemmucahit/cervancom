# Aşama 1 doğrulama kaydı

## Giriş 404 düzeltmesi

Astro `trailingSlash: 'always'` kuralı, sonu `/` ile bitmeyen API isteğini geliştirme proxy'sinden önce reddediyordu. API adresleri ve XLSX şablon bağlantıları düzeltildi; sorgu parametreleri korunur. `test:dev` iki ayrı gerçek sunucuyla açılış oturum kontrolü, yönlendirmesiz POST giriş, stok filtresi, XLSX şablonu, mal kabul/tekrar koruması ve çıkışı doğrular. TypeScript kontrolü de geçti. Önceki statik HTTP testi bu geliştirme sunucusu katmanını kapsamıyordu.

17 Ekim 2026 · Yerel geliştirme. Üretime yayın ve müşteri mesajı gönderimi yapılmadı.

| Kontrol | Sonuç |
| --- | --- |
| PGlite foundation testleri | 15/15 geçti |
| Gerçek PostgreSQL 18: aynı testler + bağımsız bağlantı yarış testi | 16/16 geçti, atlanan test yok |
| Mevcut Web3Forms regresyonları | 5/5 geçti; gerçek e-posta gönderilmedi |
| Cerplus TypeScript kontrolü | Geçti |
| Astro statik build | Geçti; mevcut sayfalar ve `/cerplus/` üretildi |
| Wrangler Pages Functions paketi | Derlendi; yaklaşık 1,1 MB minified JS, PGlite/WASM içermez |
| Cloudflare workerd çalışma zamanı | scrypt parola türetme, ExcelJS XLSX üretme/okuma ve ZIP/şablon doğrulaması geçti |
| Yerel `/cerplus/` ve `/cerplus/api/health` HTTP | 200 |
| Gerçek HTTP süreç testi | Derlenmiş site/JS/CSP, giriş, oturum, mal kabul, tekrar koruması, hareket ve çıkış geçti; izole test verisi temizlendi |
| npm audit | Kurulum ve uyumlu güncellemeler sonrası 0 açık |
| Görsel/tarayıcı kontrolü | Tamamlanamadı: bağlı tarayıcı envanteri boş, in-app browser kullanılamıyor |
| Gerçek Cloudflare Hyperdrive/PostgreSQL bağlantısı ve kota | Yapılandırılmadı; hesap/veritabanı erişimi yok |

## Testlerin kanıtladığı davranış

- Toplam 15 koli olmasına rağmen gerekli tip eksikse gardrop tamam sayılamaz. Gerekli miktar katsayıları hesaba katılır. Başka bayi stoğu bu açığı kapatamaz.
- Bayi stok listesini parametreyle veya doğrudan stok kimliğiyle aşamaz; hareketleri kendi bayisiyle sınırlıdır. Yönetim/mal kabul kapalıdır. Ekip stok okuyamaz. Henüz uygulanmamış özel dosya yolları veri döndürmez.
- Marka belirtilmeyen aynı barkod için iki eşleşme döner; bilinmeyen barkod kayıt yaratmaz. Başlangıç sıfırları katalog aktarımında korunur.
- Manuel eşzamanlı aynı kabul, aynı önizlemenin iki onayı ve yeniden XLSX yükleme kayıt/stoğu çoğaltmaz. Aynı gönderim anahtarı farklı içeriğe kullanılırsa reddedilir.
- Katalog aktarımı stok yaratmaz; satır hatası/formül/sayısal barkod bütün aktarımı engeller. Bir kullanıcının önizlemesini diğeri onaylayamaz. Hatalı kabulde hareket/stok kısmen kalmaz.
- Dolu raf kapatılamaz; transfer sahipliği korur; hasar fiziksel kullanılabilir miktarı azaltır ve hareket bırakır. Kapalı rafa kabul yapılmaz.
- Gerçek PostgreSQL'de ilk bağlantı stok satırını kilitlerken ikinci bağlantının UPDATE'i gerçekten kilitte bekler (pg_stat_activity ile gözlenir). İlk commit sonrasında ikinci UPDATE kullanılabilir miktarı tekrar değerlendirip başarısız olur; fiziksel 1 / rezerve 1 kalır. Bir transaction sonraki adımda hata verirse önceki ayırma da geri alınır.
- Origin ve CSRF reddi, oturum gerekliliği, hesap kapatıldığında erişim iptali ve audit'te parola/hash bulunmaması kontrol edilir. Geliştirme veritabanı üretim adaptöründe reddedilir.
- İade karar endpoint'i bu aşamada yoktur; ona gönderilen bayi isteği stok artırmaz. Bu test sonraki fiziksel iade akışını uygulanmış saymaz.

## Kalan kabul sınırları

Fiziksel terminal, telefon/tablet tarayıcıları ve görsel yerleşim manuel doğrulanmalı. Gerçek marka dosyaları geldikçe sütun eşleyicileri geliştirilmelidir. Stok listesi/özet 500 satır, katalog 200 ürün, hareket geçmişi 200 kayıtla sınırlıdır; bu sınırlar arayüzde açıklanır. Üretim sağlayıcısı, Hyperdrive cache kapatılması, oturum/aktarım kota ölçümü, yedekleme ve geri yükleme provası yayından önce gereklidir.

Sipariş mükerrerliği, tam ürünlerden kısmi teslimat iş akışı, özel fotoğraf/imza erişimi, bayi iade kararı + fiziksel kabul ayrımı uçtan uca testleri sırasıyla 2–4. aşamalarla eklenir; bu teslimde bu modüller tamamlandı olarak gösterilmez.
