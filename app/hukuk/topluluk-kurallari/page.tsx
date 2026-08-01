import type { Metadata } from "next";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Topluluk Kuralları" };

export default function CommunityRulesPage() {
  return (
    <LegalPage
      title="Topluluk Kuralları"
      summary="Kuzens’te herkesin kendini güvende ve rahat hissetmesi için uygulanacak net kurallar."
      sections={[
        { title: "İnsana saygı", body: <p>Taciz, zorbalık, tehdit, nefret söylemi, hedef gösterme ve kişiyi küçük düşürmeye yönelik sürekli davranışlara izin verilmez.</p> },
        { title: "Gizliliğe saygı", body: <p>Başkasının adres, telefon, kimlik, özel yazışma, görüntü veya diğer kişisel verilerini açık izni olmadan paylaşma.</p> },
        { title: "Güvenli içerik", body: <p>Çocukların istismarı, şiddet tehdidi, kendine zarar vermeyi teşvik, yasa dışı satış, zararlı yazılım veya kimlik avı içeriği yasaktır ve gerektiğinde yetkili mercilere bildirilir.</p> },
        { title: "Spam ve aldatma", body: <p>Toplu istenmeyen mesaj, sahte çekiliş, dolandırıcılık, yapay etkileşim, hesap taklidi ve yanıltıcı bağlantı kullanma.</p> },
        { title: "Fikri haklar", body: <p>Paylaşmaya hakkın olmayan telifli veya kişiye özel içeriği yayımlama. Hak sahibinin geçerli bildirimi üzerine içerik incelemeye alınır.</p> },
        { title: "Sunucu sorumluluğu", body: <p>Sunucu sahipleri ve moderatörleri kuralları tutarlı uygulamalı, yetkilerini taciz amacıyla kullanmamalı ve ciddi ihlalleri platform yöneticisine bildirmelidir.</p> },
        { title: "Yaptırım sırası", body: <p>Uyarı, içerik kaldırma, geçici susturma, oda/sunucu erişimini kısıtlama, uzaklaştırma ve hesap kapatma uygulanabilir. Ağır veya acil risk oluşturan ihlallerde basamaklar atlanabilir.</p> },
        { title: "İtiraz", body: <p>Hakkında verilen platform kararının yeniden incelenmesini uygulama içi destek kanalı üzerinden isteyebilirsin. Sunucu içi rol kararlarında önce sunucu yönetimine başvurulur.</p> },
      ]}
    />
  );
}
