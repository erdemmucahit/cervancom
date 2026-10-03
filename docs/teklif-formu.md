# Teklif formu — SMTP kurulumu

Site Cloudflare Pages üzerinde çalışır: proje **cervancom**, varsayılan adres **https://cervancom.pages.dev**, üretim adresi **https://cervanlojistik.com**. Gönderici ve teklif alıcısı **info@cervanlojistik.com** olarak ayarlanmıştır.

Formun backend’i `smtp.gmail.com:587` sunucusuna bağlanır ve zorunlu STARTTLS ile şifrelemeyi başlatır. TLS kurulmadan hesap şifresi veya e-posta gönderilmez. Hesaba özel uygulama şifresi kullanılır. Google Cloud projesi, Gmail API ve OAuth istemcisi bu yöntemde gerekmez.

## 1. Google uygulama şifresi

1. `info@cervanlojistik.com` hesabıyla [Google Hesabı → Güvenlik](https://myaccount.google.com/security) sayfasını açın.
2. **Google’da oturum açma şekliniz → 2 Adımlı Doğrulama** bölümünden iki adımlı doğrulamayı etkinleştirin.
3. [Uygulama şifreleri](https://myaccount.google.com/apppasswords) sayfasını açın.
4. Uygulama adı olarak `Cervan Teklif Formu` girip **Oluştur** deyin.
5. Oluşan 16 karakterlik şifreyi sonraki adımda Cloudflare’a gizli değer olarak girin. Google hesabınıza giriş yaparken kullandığınız normal şifreyi kullanmayın. Uygulama şifresini sohbete veya kaynak koda yazmayın.

“Aradığınız ayar, hesabınızda kullanılamıyor” mesajı varsa önce iki adımlı doğrulamanın açık olduğunu kontrol edin. Açık olmasına rağmen seçenek yoksa Workspace hesap politikası, yalnızca güvenlik anahtarıyla doğrulama veya Gelişmiş Koruma etkili olabilir. Bu durumda hesap ayarı çözülmeden uygulama şifresiyle SMTP çalışmaz. Hesap şifresini değiştirmek uygulama şifresini iptal eder. [Google uygulama şifreleri](https://support.google.com/accounts/answer/185833?hl=tr), [Google Workspace SMTP kurulumu](https://support.google.com/a/answer/176600?hl=en).

`info@…` ayrı bir hesap yerine takma ad/grup ise bunu ayrıca değerlendirin: uygulama şifresi gerçek kullanıcı hesabına aittir. Mevcut kod, oturum açan kullanıcıyı gönderici olarak kullanır.

## 2. Cloudflare gizli değerleri

Cloudflare panelinde **Workers & Pages → cervancom → Settings → Variables and Secrets** bölümünü açın. Üretim ortamında şu değerleri ekleyin:

| Değişken | Tür | Değer |
| --- | --- | --- |
| `SMTP_APP_PASSWORD` | Secret | Google’dan oluşturulan uygulama şifresi |
| `TURNSTILE_SECRET_KEY` | Secret | Aşağıda oluşturulan Turnstile gizli anahtarı |
| `PUBLIC_TURNSTILE_SITE_KEY` | İsteğe bağlı build ortamı değişkeni | Projedeki açık site anahtarını değiştirir |

Şu açık ayarlar `wrangler.jsonc` içinde zaten tanımlıdır:

| Değişken | Değer |
| --- | --- |
| `SITE_URL` | `https://cervanlojistik.com` |
| `SMTP_USER` | `info@cervanlojistik.com` |
| `QUOTE_RECIPIENT` | `info@cervanlojistik.com` |

Gizli değerleri terminalden girmek için alternatif komutlar:

```bash
npx wrangler pages secret put SMTP_APP_PASSWORD --project-name cervancom
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name cervancom
```

Şifreyi komut satırı argümanı olarak eklemeyin; aracın gizli giriş istemini kullanın. Önceki API yöntemi için eklenmiş Google OAuth değişkenleri bu sürümde kullanılmaz.

## 3. Turnstile spam koruması

Cloudflare panelinde bir **Turnstile / Managed** widget oluşturun. İzin verilen hostname olarak `cervanlojistik.com` ekleyin. Açık site anahtarı `src/config/site.ts` içindeki `turnstileSiteKey` alanında kayıtlıdır. Build ortamındaki `PUBLIC_TURNSTILE_SITE_KEY` varsa bu değeri geçersiz kılar. Böylece paneldeki değişken build ortamına aktarılmasa da üretim formu doğru açık anahtarı kullanır. Eşleşen gizli anahtar yalnızca Cloudflare’da `TURNSTILE_SECRET_KEY` olarak tutulur. Açık anahtar değişirse yeni build gerekir.

Backend güvenlik token’ını doğrular, hostname’in `SITE_URL` ile ve action’ın `quote` ile eşleşmesini arar. Her gönderim denemesinden sonra token yenilenir. [Turnstile doğrulaması](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## 4. Yayına alma

Build komutu **`npm run build`**, çıktı klasörü **`dist`**. Git bağlantılı Pages yayınına kökteki `functions/` dizini de dahil olmalıdır. `dist` klasörünü tek başına sürükleyerek yüklemek backend’i yayınlamaz.

`wrangler.jsonc`, `cervancom` projesinin Pages yapılandırmasıdır ve Node.js uyumluluğunu içerir. SMTP kodu Nodemailer, `node:net` ve STARTTLS yükseltmesinde `node:tls` kullanır. Bağlantı Cloudflare’ın alan adını çözmesiyle kurulur; TLS zorunludur ve sertifika doğrulaması açık tutulur. [Cloudflare TLS desteği](https://developers.cloudflare.com/workers/runtime-apis/nodejs/tls/).

Anahtarlar tanımlandıktan sonra mevcut Git yayın akışını kullanın. CLI ile canlı yayın alternatifi:

```bash
npm run deploy:pages
```

Bu komut canlı yayın yapar. Yeni sürümden sonra `https://cervanlojistik.com/iletisim/` üzerinde bir deneme teklifi gönderin. E-postanın `info@cervanlojistik.com` gelen kutusuna ulaştığını ve **Yanıtla** adresinin müşterinin e-postası olduğunu doğrulayın.

Form yalnızca SMTP sunucusu mesajı kabul ettiğinde başarı gösterir. SMTP kabulü gelen kutusuna kesin teslim garantisi değildir; ilk denemede spam klasörünü de kontrol edin. Hatalı gönderimde alanlar korunur ve otomatik tekrar gönderim yapılmaz.

## 5. Yerel kontrol

Yalnızca Google SMTP bağlantısını ve uygulama şifresini sınamak için `.dev.vars.example` dosyasını `.dev.vars` olarak kopyalayın; `SMTP_USER` ve `SMTP_APP_PASSWORD` alanlarını doldurup `npm run check:smtp` çalıştırın. Bu kontrol e-posta göndermez ve Turnstile anahtarı gerektirmez. Google'ın şifrede gösterdiği boşluklar temizlenir. Cloudflare'daki gizli değerler bilgisayarınıza otomatik aktarılmaz. Yerel başarı, Cloudflare bağlantısını veya mesaj teslimini doğrulamaz.

## 502 hatasını inceleme

Logdaki `outcome: "ok"`, e-posta gönderildiği anlamına gelmez: yakalanan SMTP hatasında fonksiyon normal tamamlanır, fakat HTTP yanıtı `502` olur. `TCP_CONNECT_TIMEOUT`, 587 portuna bağlantının 8 saniyede kurulamadığını; `SMTP_GREETING_TIMEOUT`, bağlantı sonrasında SMTP karşılama yanıtının gelmediğini belirtir. Önceki 465 portlu sürümdeki `TLS_CONNECT_TIMEOUT` nedeniyle 587 + zorunlu STARTTLS seçeneğine geçilmiştir. Yerelde başarılı şifre testi, Cloudflare'dan Google'a bağlantıyı doğrulamaz.

Cloudflare projesinde **Deployments → son Production deployment → Functions → Begin log stream** bölümünü açıp formu bir kez gönderin. `Quote request failed at turnstile` doğrulama servisi isteğinin, `Quote request failed at smtp-send` ise e-posta gönderiminin hata verdiğini gösterir. Yeni kod yayınlandığında log satırında yalnızca izin verilen teknik kodlar bulunur: örneğin `EAUTH` Google oturum açma reddini, `ESOCKET` bağlantı sorununu, `ETIMEDOUT` zaman aşımını belirtir. Ham sağlayıcı yanıtı, şifre ve müşteri bilgileri loglanmaz. Tarayıcıdaki genel 502 yanıtı tek başına bu nedenleri ayırt etmez.

Turnstile'ın `/pat/` isteğindeki 401, desteklenmeyen Private Access Token denemesi olabilir. Widget doğrulamayı tamamlayıp token üretiyorsa bu yanıt için işlem gerekmez. [Cloudflare hata açıklaması](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).

## Formun tamamını yerelde deneme

`.env.example` dosyasını `.env`, `.dev.vars.example` dosyasını `.dev.vars` olarak kopyalayıp kendi değerlerinizi doldurun. Bunlar Git tarafından yok sayılır. Yerel origin `http://localhost:8788` olmalıdır; ayrı geliştirme Turnstile widget’ında `localhost` adresine izin verin.

```bash
npm test
npm run preview:pages
```

`npm run dev` yalnızca Astro arayüzünü çalıştırır. `preview:pages` ile `http://localhost:8788/iletisim/` üzerinden backend’i de deneyebilirsiniz. Gerçek uygulama şifresiyle gönderim gerçek e-posta yollar.

Otomatik testler Google’a bağlanmaz: SMTP protokolünü yalnızca bilgisayarda çalışan sahte sunucuyla test eder; şifre doğrulama/alıcının reddi/gönderim hatası senaryolarını ve Türkçe MIME içeriğini kontrol eder. Önizleme alan adından formu denemek için o ortamdaki `SITE_URL` ve Turnstile hostname izinleri ayrıca eşleştirilmelidir.
