import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../LegalPage";
import { PrivacyRequestForm } from "./PrivacyRequestForm";

export const metadata: Metadata = { title: "KVKK Başvuru Merkezi" };

export default function PrivacyRequestPage() {
  return (
    <LegalPage
      title="KVKK Başvuru Merkezi"
      summary="Kişisel verilerinle ilgili hak taleplerini kayıt altına alıp elektronik olarak iletebilirsin."
      statusNote="Kamuya açılıştan önce veri sorumlusunun tam tebligat adresi ve diğer resmî başvuru kanalları bu sayfaya eklenecektir."
      sections={[
        {
          title: "Başvuru yöntemi",
          body: <><p>Aşağıdaki form, başvuru amacına yönelik uygulama kanalıdır. Talebini açıkça belirt; yalnızca talebinle ilgili bilgileri paylaş.</p><PrivacyRequestForm /></>,
        },
        {
          title: "Süre ve ücret",
          body: <p>Talebin niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz sonuçlandırılır. İşlemin ayrıca maliyet gerektirmesi hâlinde yalnızca mevzuatta izin verilen ücret talep edilebilir.</p>,
        },
        {
          title: "Şikâyet hakkı",
          body: <p>Başvurunun reddedilmesi, cevabın yetersiz olması veya süresinde cevap verilmemesi hâlinde KVKK’daki süreler içinde Kişisel Verileri Koruma Kuruluna şikâyet hakkın vardır.</p>,
        },
        {
          title: "Diğer belgeler",
          body: <p>Veri işleme ayrıntıları için <Link href="/hukuk/aydinlatma">Kayıt ve Üyelik Aydınlatma Metni</Link> ile <Link href="/hukuk/gizlilik">Gizlilik Politikası</Link>nı inceleyebilirsin.</p>,
        },
      ]}
    />
  );
}
