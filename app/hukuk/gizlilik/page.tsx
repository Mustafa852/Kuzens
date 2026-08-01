import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Gizlilik Politikası" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Gizlilik Politikası"
      summary="Kuzens’in veri minimizasyonu, saklama, güvenlik ve kullanıcı kontrolü yaklaşımını açıklar."
      statusNote="Bu politika hukuki yapıyı ve ürün kararlarını tanımlar. Veri sorumlusu kimlik ve tebligat bilgilerinin kamuya açılıştan önce tamamlanması gerekir."
      sections={[
        {
          title: "Temel yaklaşım",
          body: <p>Yalnızca hizmetin çalışması için gerekli veriyi toplarız. Reklam profili oluşturmayız, kişisel verileri satmayız ve bu sürümde davranışsal takip kullanmayız.</p>,
        },
        {
          title: "Mesajlar ve topluluk verileri",
          body: <p>Mesajlar, oda bilgileri ve rol atamaları topluluk işlevlerinin çalışması için saklanır. Kullanıcı bir mesajı veya hesabını sildiğinde, hukuki zorunluluk ve güvenlik ihtiyacı bulunmadıkça ilişkili kayıtlar silme sürecine alınır.</p>,
        },
        {
          title: "Ses ve ekran paylaşımı",
          body: <p>Ses ve ekran akışları canlı iletişim amacıyla işlenir. Ayrı ve açık bir kayıt özelliği sunulmadıkça Kuzens bu akışları kalıcı olarak kaydetmez. Tarayıcı izinleri kullanıcı tarafından her an kapatılabilir.</p>,
        },
        {
          title: "Saklama süreleri",
          body: <ul><li>Hesap ve topluluk verileri: hesap veya ilgili topluluk silinene kadar</li><li>Güvenlik ve hata kayıtları: güvenlik incelemesi için gerekli makul süre boyunca</li><li>KVKK başvuru kayıtları: talebin sonuçlandırılması ve hukuki yükümlülüklerin belgelenmesi için gerekli süre boyunca</li></ul>,
        },
        {
          title: "Güvenlik",
          body: <p>Erişim kontrolü, en az yetki, sunucu taraflı yetkilendirme, şifreli aktarım ve kayıtlı değişiklik geçmişi gibi makul teknik/idari önlemler uygulanır. Hiçbir internet hizmeti mutlak güvenlik garanti edemez.</p>,
        },
        {
          title: "Çocukların gizliliği",
          body: <p>Bu geliştirme sürümü 18 yaş altına yönelik değildir. 18 yaş altı bir kişiye ait kayıt fark edilirse hesap ve ilişkili veriler incelemeye alınır.</p>,
        },
        {
          title: "Kontrol ve başvuru",
          body: <p>Verilerine erişmek, düzeltmek veya silme talebi oluşturmak için <Link href="/hukuk/basvuru">KVKK Başvuru Merkezi</Link>ni kullanabilirsin. Ayrıntılı işleme bilgisi için faaliyet bazlı <Link href="/hukuk/aydinlatma">Aydınlatma Metni</Link> geçerlidir.</p>,
        },
      ]}
    />
  );
}
