# Kuzens Windows yayım rehberi

Bu yapı, Windows için gerçek `.exe` dosyaları üretir. Web kurucusu uygulama paketini GitHub Release'den indirir; kurulu sürüm de yeni masaüstü sürümlerini aynı yerden denetler.

## İlk kurulum — bir kez yapılacak

1. GitHub'da `Mustafa852` hesabını aç.
2. Sağ üstteki **+** menüsünden **New repository** seç.
3. Depo adını tam olarak `Kuzens` yaz.
4. Kullanıcıların kurulum dosyasını giriş yapmadan indirebilmesi için **Public** seç.
5. **Add a README file** seçeneğini işaretleme; `.gitignore` ve lisans da ekleme. Depo tamamen boş oluşmalı.
6. **Create repository** düğmesine bas.
7. Depo hazır olduğunda Codex'e yalnızca “GitHub deposunu açtım” yaz.

Depo adını veya hesabı değiştirirsen `package.json` içindeki `build.publish.owner` ve `build.publish.repo` alanları da değiştirilmelidir.

## Yeni sürüm yayımlama

Kod GitHub'a bağlandıktan sonra bir sürüm etiketi göndermek yeterlidir:

```powershell
npm version patch
git push github main --follow-tags
```

- `patch`: 1.0.0 → 1.0.1 gibi küçük düzeltmeler.
- `minor`: 1.0.0 → 1.1.0 gibi yeni özellikler.
- `major`: 1.0.0 → 2.0.0 gibi büyük ve uyumsuz değişiklikler.

GitHub Actions etiketi gördüğünde Windows derlemesini otomatik yapar ve Release sayfasında web kurucusu ile taşınabilir dosyayı yayımlar.

## Kullanıcı ne indirecek?

Normal kullanıcıya `Kuzens-Web-Kurulum-x.y.z.exe` dosyasını gönder. Bu küçük dosya doğru uygulama paketini GitHub'dan indirip Başlat menüsü ve masaüstü kısayolunu oluşturur.

Kurulum istemeyen kullanıcı `Kuzens-Portable-x.y.z.exe` dosyasını indirebilir. Portable sürüm otomatik güncellenmez.

## Ücretsiz imza gerçeği

Uygulama kod imzalama sertifikası olmadan da çalışır ve dağıtılabilir. Ancak Windows SmartScreen ilk indirmelerde “Windows bilgisayarınızı korudu” uyarısı gösterebilir. Kullanıcı **Ek bilgi → Yine de çalıştır** yoluyla devam edebilir. Bu uyarıyı güvenilir biçimde kaldırmak için gelecekte ücretli bir kod imzalama sertifikası gerekir; şu an sıfır bütçe hedefi nedeniyle imzasız yayımlanır.

## Yerel test

```powershell
npm run desktop:package
```

Üretilen normal kurucuyu ve Portable sürümü `release/` klasöründe bulabilirsin. Kurulum testi için önce Portable dosyasını açmak daha hızlıdır.
