# Kuzens

Kuzens; topluluklar, metin kanalları, sesli odalar, ekran paylaşımı ve arkadaşlık sistemi için geliştirilen özgün bir iletişim uygulamasıdır.

## Kullanıcı bağlantıları

- Web uygulaması: <https://kuzens-chat.ilhanilhan239.chatgpt.site/>
- Windows sürümleri: GitHub deposundaki **Releases** bölümünde yayımlanır.

## Windows sürümleri

Kuzens'i Windows'a kurmanın önerilen iki yolu vardır:

- **Tarayıcıdan uygulama olarak yükleme (PWA):** `stromv2.com.tr` adresini Edge veya Chrome ile açıp Kuzens ayarlarındaki **Kuzens'i yükle** düğmesine bas. EXE indirilmediği için SmartScreen uyarısı çıkmaz.
- **Microsoft Store:** Store paketi için otomatik üretim hattı hazırdır. Store yayını tamamlandığında uygulama Microsoft tarafından imzalanır ve SmartScreen uyarısı olmadan kurulur.

GitHub sürümlerinde ayrıca iki doğrudan dağıtım dosyası üretilir:

- `Kuzens-Web-Kurulum-x.y.z.exe`: Küçük kurulum dosyasıdır; gereken uygulama paketini GitHub Release üzerinden indirir ve kurar.
- `Kuzens-Portable-x.y.z.exe`: Kurulum gerektirmeden doğrudan çalışır.

Doğrudan indirilen EXE dosyaları güvenilir bir kod imzalama sertifikası eklenene kadar Windows tarafından “bilinmeyen yayıncı” olarak gösterilebilir. Bu bir virüs tespiti değildir; Microsoft Store veya güvenilir Authenticode imzası bu dağıtım uyarısını çözer.

Kurulu sürüm, yeni masaüstü sürümlerini GitHub üzerinden denetler. Web arayüzündeki geliştirmeler canlı adresten yüklendiği için ayrıca uygulama güncellemesi gerektirmez.

## Geliştirme

Gereksinim: Node.js 22.13 veya üzeri.

```powershell
npm install
npm run dev
```

Masaüstü penceresini geliştirme modunda açmak için:

```powershell
npm run desktop:dev
```

Web ve test doğrulamaları:

```powershell
npm test
npm run lint
```

Yerel Windows dosyaları:

```powershell
npm run desktop:package
```

Çıktılar `release/` klasörüne yazılır. GitHub yayım adımları [DESKTOP.md](DESKTOP.md) dosyasında anlatılmıştır.

## Güvenlik

Electron kabuğunda Node.js erişimi kapalıdır; context isolation, Chromium sandbox ve web security açıktır. Kamera, mikrofon, bildirim ve ekran paylaşımı izinleri yalnızca resmi Kuzens web kaynağına verilir. Dış bağlantılar varsayılan sistem tarayıcısında açılır.

Güvenlik açığı bildirimleri için [SECURITY.md](SECURITY.md) dosyasını kullanın.

## Haklar

Copyright © 2026 Kuzens. Tüm hakları saklıdır. Bu depoda açık kaynak lisansı bulunmadığı sürece kaynak kodun görüntülenebilmesi; kopyalama, yeniden dağıtma veya ticari kullanım izni vermez.
