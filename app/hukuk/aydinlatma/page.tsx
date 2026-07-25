import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };

export default function NoticePage() {
  return (
    <LegalPage
      title="Kayıt ve Üyelik KVKK Aydınlatma Metni"
      summary="Hesap oluşturma sırasında elde edilen kişisel veriler için faaliyet bazlı aydınlatmadır; açık rıza metni değildir."
      statusNote="Veri sorumlusunun tam adı/unvanı ve fiziksel tebligat adresi kamuya açılıştan önce gerçek işletmeci bilgileriyle tamamlanmalıdır. Şimdilik veri sorumlusu, Kuzens geliştirme sürümünün sahibi ve yöneticisidir."
      sections={[
        {
          title: "Veri sorumlusu",
          body: <p>Kişisel verilerin bakımından veri sorumlusu, Kuzens hizmetinin sahibi ve yöneticisidir. Başvurular elektronik olarak <Link href="/hukuk/basvuru">KVKK Başvuru Merkezi</Link> üzerinden alınır.</p>,
        },
        {
          title: "İşlenen kişisel veriler",
          body: <ul><li>Hesap: ad, kullanıcı adı ve doğrulanmış hesap e-postası</li><li>Üyelik: sözleşme ve aydınlatma sürümü, onay zamanı, yaş teyidi</li><li>İçerik: mesajlar, oda ve rol kayıtları, kullanıcı tarafından paylaşılan bağlantılar</li><li>Güvenlik: işlem zamanı, temel bağlantı ve hata kayıtları</li><li>Ses/görüntü: canlı iletim; kayıt özelliği açıkça sunulmadıkça kalıcı kayıt yapılmaz</li></ul>,
        },
        {
          title: "İşleme amaçları",
          body: <p>Hesabın oluşturulması, hizmetin sunulması, mesajların iletilmesi ve saklanması, yetkilerin uygulanması, kötüye kullanımın önlenmesi, güvenliğin sağlanması, kullanıcı taleplerinin cevaplanması ve hukuki yükümlülüklerin yerine getirilmesi.</p>,
        },
        {
          title: "Hukuki sebepler",
          body: <p>Veriler; KVKK m.5/2 kapsamında sözleşmenin kurulması veya ifası, veri sorumlusunun hukuki yükümlülüğü, bir hakkın tesisi/kullanılması/korunması ve temel haklara zarar vermemek kaydıyla meşru menfaat hukuki sebeplerine dayanılarak işlenir. Açık rıza gerektiren yeni bir faaliyet eklenirse rıza, bu metinden ayrı alınır.</p>,
        },
        {
          title: "Toplama yöntemi",
          body: <p>Veriler kayıt formu, uygulama içi işlemler, güvenlik kayıtları ve kimlik sağlayıcının doğrulanmış kullanıcı başlıkları aracılığıyla elektronik ortamda elde edilir.</p>,
        },
        {
          title: "Aktarım ve alıcı grupları",
          body: <p>Veriler; hizmeti barındıran altyapı ve güvenlik sağlayıcılarına yalnızca hizmetin çalışması için gerekli ölçüde, ayrıca hukuken yetkili kamu kurumlarına usulüne uygun talep hâlinde aktarılabilir. Yurt dışı aktarım söz konusu olduğunda KVKK m.9 şartları uygulanır.</p>,
        },
        {
          title: "Hakların ve başvuru",
          body: <p>KVKK m.11 kapsamındaki bilgi alma, düzeltme, silme/yok etme, aktarılan üçüncü kişileri öğrenme, otomatik işleme sonucuna itiraz ve zararın giderilmesini isteme haklarını kullanabilirsin. Başvurular en kısa sürede ve en geç 30 gün içinde sonuçlandırılır.</p>,
        },
      ]}
    />
  );
}
