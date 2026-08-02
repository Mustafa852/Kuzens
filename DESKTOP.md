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

## SmartScreen uyarısını kaldırma

SmartScreen, doğrudan indirilen dosyanın imzasını ve indirme itibarını denetler. Dosya adı, uygulama simgesi veya paket içindeki şirket adı tek başına güvenilir yayıncı oluşturmaz. Kendinden imzalı sertifika da başka bilgisayarlarda güvenilir sayılmaz.

Sıfır bütçeyle önerilen kalıcı çözüm Microsoft Store'dur. Yeni Microsoft Store geliştirici hesabı ücretsiz açılabilir; Store'a MSIX olarak gönderilen uygulamayı Microsoft imzalar. Kullanıcı Store üzerinden kurduğunda SmartScreen indirme uyarısı görmez.

### Bir kez yapılacak Microsoft Store işlemleri

1. <https://storedeveloper.microsoft.com> adresinden **Individual developer** hesabını ücretsiz aç ve kimlik doğrulamasını tamamla.
2. Partner Center'da **Apps and games → New product → MSIX or PWA app** yoluyla `Kuzens` adını ayır.
3. Oluşturulan ürünün **Product management → Product identity** sayfasını aç.
4. Buradaki `Package/Identity/Name`, `Package/Identity/Publisher` ve `Publisher display name` değerlerini kaydet.
5. GitHub deposunda **Actions → Microsoft Store paketini hazirla → Run workflow** ekranını açıp bu üç değeri gir.
6. İşlem bitince oluşan `Kuzens-Microsoft-Store` paketini indir ve Partner Center'daki paket yükleme alanına gönder.

Store onayından önce beklemek istemeyen kullanıcılar, `stromv2.com.tr` adresini Edge veya Chrome'da açıp Kuzens ayarlarından **Kuzens'i yükle** seçeneğini kullanabilir. Bu PWA kurulumu EXE indirmediği için SmartScreen uyarısı göstermez.

### İleride doğrudan EXE imzalama

Güvenilir bir Authenticode `.pfx` sertifikası edinilirse GitHub depo sırlarına `WIN_CSC_LINK` ve `WIN_CSC_KEY_PASSWORD` eklemek yeterlidir. Yayın hattı sonraki kurulum ve taşınabilir EXE dosyalarını otomatik imzalar. İmza yayıncı adını doğrular; yeni bir imzanın SmartScreen itibarı yine zaman içinde oluşabilir.

## Yerel test

```powershell
npm run desktop:package
```

Üretilen normal kurucuyu ve Portable sürümü `release/` klasöründe bulabilirsin. Kurulum testi için önce Portable dosyasını açmak daha hızlıdır.
