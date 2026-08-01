import type { Metadata } from "next";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Çerez Politikası" };

export default function CookiePage() {
  return (
    <LegalPage
      title="Çerez Politikası"
      summary="Kuzens’in tarayıcı depolama ve zorunlu teknik tanımlayıcı kullanımını açıklar."
      sections={[
        {
          title: "Bu sürümde kullanılanlar",
          body: <p>Oturumun güvenli biçimde sürdürülmesi, kimlik doğrulama, kötüye kullanımın önlenmesi ve arayüz tercihlerinin cihazda hatırlanması için kesinlikle gerekli teknik tanımlayıcılar kullanılabilir.</p>,
        },
        {
          title: "Kullanılmayanlar",
          body: <p>Bu sürümde reklam çerezi, üçüncü taraf davranışsal takip, çapraz site profilleme veya pazarlama analitiği kullanılmaz.</p>,
        },
        {
          title: "Hukuki dayanak",
          body: <p>Kesinlikle gerekli teknik kullanım, hizmetin kullanıcı tarafından talep edilen şekilde sunulabilmesi ve güvenliği için yürütülür. Zorunlu olmayan bir kategori eklenirse önceden ayrı tercih arayüzü sunulur.</p>,
        },
        {
          title: "Tarayıcı kontrolü",
          body: <p>Tarayıcı ayarlarından çerez ve site verilerini silebilirsin. Zorunlu tanımlayıcıları tamamen engellemek oturum açma veya güvenlik özelliklerinin çalışmamasına yol açabilir.</p>,
        },
      ]}
    />
  );
}
