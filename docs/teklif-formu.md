# Teklif formu — Web3Forms

Form tarayıcıdan doğrudan https://api.web3forms.com/submit adresine gönderilir. SMTP, Google uygulama şifresi, Turnstile, Cloudflare Function veya özel mail backend'i kullanılmaz. Mevcut form tasarımı korunur. [Web3Forms API](https://docs.web3forms.com/getting-started/api-reference).

## 1. Form anahtarı

1. [Web3Forms](https://web3forms.com/) üzerinden info@cervanlojistik.com adresi için form / Access Key oluşturun.
2. Bu e-posta adresine gelen doğrulamayı tamamlayın.
3. Anahtarı yerelde .env dosyasındaki PUBLIC_WEB3FORMS_ACCESS_KEY alanına yazın. .env.example bir örnektir.
4. npm run dev ile http://localhost:4321/iletisim/ adresinden deneyin. Gerçek anahtarla form gönderimi gerçek e-posta gönderir.

```dotenv
PUBLIC_WEB3FORMS_ACCESS_KEY=WEB3FORMS_FORM_ANAHTARINIZ
```

Access Key tarayıcı kullanımı için tasarlanmıştır ve sayfa kodunda görünür. Buraya Google şifresi veya başka bir servisin gizli API anahtarını yazmayın. Anahtarın bağlı olduğu e-posta adresi teslim alıcısını belirler. Müşterinin email alanı yanıt adresidir.

## 2. Cloudflare Pages yayını

Workers & Pages → cervancom → Settings bölümünde **build ortamı / Environment variables** altında Production için PUBLIC_WEB3FORMS_ACCESS_KEY ekleyin. Bu değer build sırasında sayfaya gömülür; yalnızca runtime secret eklemek yeterli değildir.

Build komutu: **npm run build**. Çıktı klasörü: **dist**. Git bağlantılı mevcut Pages yayınını kullanın. Anahtar eklendiğinde veya değiştiğinde yeniden build gerekir. Kodu yayına göndermek için Git komutlarını kendiniz çalıştırın.

Eski SMTP_APP_PASSWORD, SMTP_USER, QUOTE_RECIPIENT, SITE_URL, TURNSTILE_SECRET_KEY, PUBLIC_TURNSTILE_SITE_KEY ve varsa önceki Google OAuth / Apps Script ayarları yeni form tarafından kullanılmaz. Cloudflare'dan kaldırabilirsiniz. Yerelde .dev.vars da artık kullanılmaz; gerçek şifre içeren bu dosya Git tarafından yok sayılmaya devam eder.

## 3. Kullanım ve sınırlar

Web3Forms Free planı **aylık 250 gönderim** içerir. Ayda 500 teklif için yeterli değildir; uygun ücretli plan veya daha düşük kullanım gerekir. [Güncel fiyatlar](https://web3forms.com/pricing).

Formda CAPTCHA kutusu yoktur. Web3Forms'un sunucu tarafındaki spam kontrolü ve botcheck görünmez alanı kullanılır. Bu, spamı tamamen engelleme garantisi vermez. [Spam koruması](https://docs.web3forms.com/getting-started/customizations/spam-protection).

Gönderim sırasında buton kilitlenir. Başarı yalnızca Web3Forms success: true yanıtı verdiğinde gösterilir. Hata veya bağlantı kesintisinde alanlar korunur. Otomatik tekrar gönderim yapılmaz. Anahtar yoksa form gönderime kapanır ve e-posta ile iletişim önerir.

İlk gerçek denemede info@cervanlojistik.com gelen kutusunu ve spam klasörünü kontrol edin; Yanıtla adresi formu dolduran kişinin e-postası olmalıdır. Google gönderilmiş öğelerine Web3Forms'un gönderdiği mesaj eklenmez.

## Kontrol komutları

```bash
npm test
npm run build
npm run dev
```

Testler Web3Forms'a bağlanmaz ve e-posta göndermez. Tarayıcıdan doğru API'ye gönderim, başarı/hata, kota yanıtı, eksik anahtar, botcheck ve çift tıklama davranışını kontrol eder.
