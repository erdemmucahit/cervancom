# Cerplus gereksinimleri

Durum: 17 Ekim 2026 · Aşama 1 geliştirmesi. Bu belge talep edilen nihai kapsamı ve ilk teslimin sınırını ayırır.

## Kesinleşen kurallar

- Ankara, Europe/Istanbul, pazar hariç 09.00–18.00; başlangıç 1 depo, 3 ofis kullanıcısı, 5 araç ve ikişer kişilik 5 ekip. Ekip başına bir saha hesabı. 45 teslimat/gün hedeftir; kapasite garantisi değildir.
- Türkçe, duyarlı web uygulaması; ofis, telefon, tablet ve klavye gibi çalışan barkod terminalleri. İlk sürüm çevrimiçi çalışır.
- Ürün kimliği marka + ürün kodu + varyanttır. Ürün, sıra numarası ve gereken miktarı tanımlı koli tiplerinden oluşur. Barkod koli tipini tanımlar; fiziksel koli seri numarası değildir. Aynı markada çakışan barkod reddedilir, markalar arasında aynı barkod bulunabilir. Marka belirtilmeyen belirsiz okutma seçim ister.
- Tam ürün sayısı her koli tipi için `floor(kullanılabilir / gereken)` değerlerinin en küçüğüdür. 15 toplam koli, eksik bir koli tipini telafi etmez. Eşdeğer farklı kabullerden koliler aynı ürünün takımlarında kullanılabilir; farklı raflarda tutulabilir.
- Katalog yükleme stok yaratmaz. Excel aktarımı önizleme, satır hataları, atomik onay ve içerik temelli mükerrer kontrolü gerektirir. Barkod/ürün kodları Excel'de metindir; baştaki sıfırlar korunur. Hatalı dosya kısmen kaydedilmez.
- Stok anahtarı depo/raf + koli tipi + sahip (bayi veya ortak). Fiziksel, rezerve, korunmuş ve kullanılabilir miktarlar ayrı tutulur. Bayi A stoğu bayi B'ye kullanılamaz; öneride önce ilgili bayi, sonra ortak stok tüketilir. Miktar negatif olamaz; dolu raf silinemez.
- Mal kabul, transfer, rezervasyon, sevk, fiziksel iade kabulü ve hasar hareketleri izlenebilir. Bayinin iade kararı stok hareketi değildir.
- Sipariş kimliği bayi + benzersiz bayi sipariş numarasıdır; asıl sipariş tarihi önceliklidir ve elle değişiklik gerekçesi saklanır. Müşteri/telefon/adres/il/ilçe/kat/asansör/dış asansör/söküm bilgisi tutulur. Satış fiyatı KDV dahil, ürün bazında ve işlem anındaki değerle saklanır; para tamsayı kuruştur.
- Kısmi teslimat yalnızca tam ürünlerle yapılır. Karşılanabilirlik, öneri ve kesin rezervasyon farklıdır. Öneri planı aynı stoğu tekrar kullanamaz; eksikler ve gerekçe görünür. Kesin rezervasyon otomatik bozulmaz. Onay veritabanı işlemi ve koşullu güncellemeyle yeniden stok kontrolü yapar.
- Eksik ürünün mevcut kolileri süresiz otomatik ayrılmaz. Eski sipariş ile başka tamamlanabilir sipariş çatışmasında personel tamamlanana ayır / eskiye koru / karar verme seçer. Koşul özetiyle karar saklanır; koşullar değişince yeniden değerlendirilir. Koli koruması tam ürün rezervasyonundan ayrıdır.
- Stok ayırma ve müşteri daveti ayrıdır. Süreli teslimata özgü bağlantı ürünleri ve kapasiteye uygun ayarlanabilir sabah/öğleden sonra aralıklarını gösterir. Müşteri seçimi ve operasyon onayı birlikte gerekir. Yanıtsızlar takip listesine gider; rezervasyon otomatik kalkmaz. Bir siparişte birden çok teslimat/randevu olabilir.
- Ekip-araç varsayılan ataması değiştirilebilir; ikinci sefer mümkündür. Her seferin hacim/ağırlık/yol/yükleme/montaj/zaman aralığı/çalışma saatleri ayrı hesaplanır. Öneriyi personel değiştirebilir. m³/kg kontrolü üç boyutlu sığma garantisi değildir. Toplama/yükleme koli tipi + miktar + raf üzerinden barkodla doğrulanır.
- Ekip yalnızca atanan işleri görür. Teslimat/montaj ürün bazında; sonuç, açıklama, fotoğraf, imza, parça talebi tutulur. Sunucu ve gerekli dosyalar tamamlanmadan başarılı kapanış yoktur. Teslimat, servis ve sipariş kapanışı ayrıdır.
- Sonuçlar: sorunsuz, kısmi, servis/parça bekliyor, kabul edilmedi, ulaşılamadı, iptal/iade talebi. Bayi kendi sorunlarını sonuçlandırır; fiziksel iade depoda kontrol ve kabul gerektirir.
- Admin, operasyon, ekip, bayi rolleri sunucuda uygulanır. Bayi yalnızca kendi kayıtları ve yetkili özel dosyalarına erişir; stok değiştiremez. Kritik değişiklikte kişi/zaman/önce/sonra kaydı zorunludur. Dosyalar herkese açık olmayacaktır.
- Raporlar: fiziksel/rezerve/kullanılabilir stok, bekleyen/teslim sipariş, eksik koliler, raf doluluğu (kapasite varsa hacim), sefer/araç m³/kullanım, ekip performansı, müşteri ve ziyaret ayrı sayıları, il/ilçe dağılımı; sevk/teslim/iade KDV dahil satış tutarları yalnızca ilgili ürün miktarlarıyla.
- Sağlayıcı hesabı yok: SMS, WhatsApp/Telegram, harita/rota, Arvento/canlı takip sonraki aşamalardır. İlk randevu bağlantısını personel paylaşır. Müşteri takibi yalnızca ilgili teslimat süresine açılır.

## İlk çalışan teslim

Giriş/çıkış, kalıcı kullanıcı ve roller, admin kullanıcı/bayi/bölüm/raf yönetimi, marka ve çok kolili ürün kataloğu, XLSX katalog önizleme/onayı, manuel/barkod/XLSX mal kabul, sahipli stok, raf transferi, hasar çıkışı, stok ve hareket sorgusu. Gerçek veritabanı migration'ları, yalnızca geliştirmeye ait örnek veriler ve yerel talimatlar dahildir. Kullanıcı hesabı kapatma ve parola değiştirme desteklenir. Katalog var olan ürüne sessizce yazmaz; hatalı katalog düzeltmesi ilk sürümde onaylı yeni içeri aktarımla değiştirme yerine reddedilir.

Sipariş/randevu/sevkiyat/saha ekranları bu teslimde yapılmış gibi gösterilmez. Tam takım hesabı ve atomik stok ayırma çekirdeği sonraki aşamanın test edilebilir altyapısıdır; kullanıcıya rezervasyon iş akışı açılmaz. Dosya servisi henüz yoktur; bilinmeyen/dosya yolları veri vermez.

## Açık kararlar ve yayın önkoşulları

1. Kullanıcı yalnızca Cloudflare hesabı bulunduğunu doğruladı. Üretim hedefi Pages Functions + Hyperdrive olarak güncellendi. Ayrıca yönetilen PostgreSQL sağlayıcısı, yedekleme sorumlusu ve Cloudflare CPU/bellek kotası doğrulaması gerekir; Node sunucusu kiralamak varsayılan değildir.
2. Gerçek marka Excel örnekleri ve sütun eşleştirmeleri: ilk aşama indirilebilir standart `.xlsx` şablonuyla çalışır; özel marka eşleyicileri örnekler geldikçe eklenir. Eski `.xls` önce `.xlsx` yapılır.
3. Kimlerin admin/operasyon olacağı ve gerçek bayi listesi; ilk admin güvenli komut satırı kurulumu ile oluşturulur.
4. Rezervasyon karar yetkisi, eksik koli koruması gözden geçirme süresi, manuel öncelik gerekçeleri (aşama 2).
5. Randevu aralıkları/kapasiteleri ve davet ömrü; araç kapasiteleri, ürün montaj süreleri, ikinci sefer politikası (aşama 3).
6. Hangi saha sonuçlarında fotoğraf/imza zorunlu olduğu, saklama/silme süreleri ve bayi erişim politikası (aşama 4).
7. Bildirim/harita/takip sağlayıcısı ve bütçe (aşama 5).

Üretim yayını, ücretli hesap açma ve gerçek müşteri mesajı ayrıca talimat gerektirir.
