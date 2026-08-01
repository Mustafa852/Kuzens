# Kuzens

Kuzens; topluluklar, metin kanalları, sesli odalar, ekran paylaşımı ve arkadaşlık sistemi için geliştirilen özgün bir iletişim uygulamasıdır.

## Kullanıcı bağlantıları

- Web uygulaması: <https://kuzens-chat.ilhanilhan239.chatgpt.site/>
- Windows sürümleri: GitHub deposundaki **Releases** bölümünde yayımlanır.

## Windows sürümleri

Her sürümde iki dosya üretilir:

- `Kuzens-Web-Kurulum-x.y.z.exe`: Küçük kurulum dosyasıdır; gereken uygulama paketini GitHub Release üzerinden indirir ve kurar.
- `Kuzens-Portable-x.y.z.exe`: Kurulum gerektirmeden doğrudan çalışır.

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
