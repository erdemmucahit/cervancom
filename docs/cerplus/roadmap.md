# Cerplus yol haritası

## 1 — Kimlik, katalog ve depo temeli (bu teslim)

Bağımlılıklar: mevcut Astro site incelemesi, PostgreSQL şeması ve yerel çalışma ortamı.

Kabul: giriş/çıkış ve sunucu rol kontrolü; admin kullanıcı/bayi/bölüm/raf yönetimi; çok kolili katalog ve marka bağlamlı barkod; manuel/terminal/XLSX kabul; önizleme + satır hatası + atomik/mükerrer korumalı aktarım; raf ve sahip bazında kalıcı fiziksel/rezerve/kullanılabilir stok; transfer ve hasar geçmişi; dolu raf silmeme; bayi izolasyonu; migration, geliştirme seed'i ve kurulum belgesi. Mevcut site/form testleri ve build geçer. Tablolar boşsa gerçek boş durum gösterilir.

Testler: katalog yüklemesi stok yaratmaz; 15 toplam ama eksik koli tipi tamam sayılmaz; başka bayi stoğu kullanılamaz; tekrar XLSX kabul/katalog stok veya kayıt çoğaltmaz; hata bütün aktarımı geri alır; bayi başkasının stok/hareketine ve bilinmeyen dosyalara erişemez; stok azaltma/ayırma yarışında en fazla bir işlem başarılıdır. Sonraki aşamalar için tam takım ve atomik ayırma çekirdeği birim/DB testleri hazırlanır. Canlı PostgreSQL testi ayrı çalıştırılır.

## 2 — Sipariş, öneri, karar ve rezervasyon

1'e bağlı. Gerçek bayi sipariş Excel örnekleri gerekir.

Kabul: bayi + sipariş no tekilliği, asıl tarih ve KDV dahil fiyat anlık kopyası, önizlemeli/idempotent aktarım; eski sipariş öncelikli ortak öneri planı aynı stoğu iki kez kullanmaz; eksik tip/miktar ve diğer sipariş etkisi görünür. Personel seçimleri ve eksik takım koruma kararları koşul özetiyle saklanır. Rezervasyon onayında kullanılabilir stok atomik kontrol edilir; kesinleşen rezervasyon otomatik bozulmaz.

Testler: eşzamanlı iki gerçek PostgreSQL bağlantısıyla fazla rezervasyon engeli; yalnız tam ürünlerden kısmi teslim; geçmiş karar aynı koşulda yeniden sorulmaz, koşul değişince yeniden değerlendirilir; mükerrer sipariş aktarımı yok; başka bayi stoğu seçilemez; kuruş hesapları tamdır.

## 3 — Randevu ve depo çıkışı

2'ye bağlı. Aralık/kapasite/araç/montaj süreleri kesinleştirilir.

Kabul: stok ayır ve davet ayrı; güvenli süreli teslimat bağlantısı, müşteri seçimi + operasyon onayı; yanıtsız takip ve elle karar. Sefer başına kg/m³/zaman hesabı, ekip/araç ve ikinci sefer yönetimi; sığmayan işler açık. Raf/koli/miktar toplama ve barkod yükleme doğrulaması; sevk hareketi.

Testler: kapasite yarışı/son kontenjan, pazar/saat sınırları, davet kapsamı/süresi, eksik yüklemeyi kapatmama, ikinci seferde kapasitenin yeniden hesaplanması.

## 4 — Saha, bayi sorunları ve raporlar

3'e bağlı. Fotoğraf/imza zorunlulukları ve saklama politikası belirlenir.

Kabul: ekip yalnız kendi atamasını görür; ürün bazında sonuç, fotoğraf, imza, servis/parça; dosya ve sunucu onayından önce kapanış yok. Bayi sorun kararı, fiziksel iade kontrol/kabul akışı; teslimat/servis/sipariş durumları ayrı. İstenen raporlar ürün miktarlarını ve işlem fiyatını esas alır; müşteri ve ziyaret sayısı ayrıdır.

Testler: başka bayi/ekip kaydına ve özel dosyaya erişim yok; dosya yüklemesi yarıda kesilince başarılı kapanış yok; bayi iade kararı stok artırmaz; yalnız fiziksel kabul stok artırır; kısmi teslim/iade raporlarının bedel ve miktarları doğrudur.

## 5 — Sağlayıcılar ve gelişmiş planlama

2–4'e ve gerçek sağlayıcı hesapları/izinlere bağlı.

Kabul: sağlayıcı değiştirilebilir SMS/WhatsApp/Telegram, hata/tekrar/outbox yönetimi, yol/montaj/mesai pencerelerini kullanan rota önerisi, teslimata ve süreye özel müşteri araç takibi. Gerçek servis yoksa açıkça yapılandırılmamış görünür. Ücretli servis ve gerçek mesaj için ayrıca talimat alınır.

## Yayına geçiş kapısı

Üretim sağlayıcısı/TLS, gerçek PostgreSQL üzerinde entegrasyon/yük testi, yedekleme ve geri yükleme provası, admin kurulumu, özel dosya politikası ve işletim izleme tamamlanır. Yerel PGlite testleri üretim çok bağlantılı yarış testi olarak raporlanmaz. Bu görevde üretime yayın yapılmaz.
