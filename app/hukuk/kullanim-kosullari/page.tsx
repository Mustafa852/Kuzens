import type { Metadata } from "next";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Kullanım Koşulları" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Kullanım Koşulları"
      summary="Kuzens hesabını ve topluluk özelliklerini kullanırken tarafların hak ve sorumluluklarını düzenler."
      statusNote="Bu geliştirme sürümünde hizmet sahibi gerçek kişinin tam adı/unvanı, tebligat adresi ve doğrulanmış iletişim bilgisi henüz eklenmemiştir. Bu bilgiler tamamlanmadan hizmet kamuya açılamaz."
      sections={[
        {
          title: "Taraflar ve kabul",
          body: <p>Bu koşullar, Kuzens hizmetini işleten kişi ile hesap oluşturan kullanıcı arasındaki sözleşmedir. Hesap oluştururken koşulları ayrı bir kutucukla kabul etmen istenir.</p>,
        },
        {
          title: "Yaş ve hesap güvenliği",
          body: <><p>Bu ön sürüm yalnızca 18 yaşını doldurmuş kullanıcılar içindir. Hesap bilgilerini doğru tutmak, hesabına erişimi korumak ve yetkisiz kullanımı bildirmek senin sorumluluğundadır.</p></>,
        },
        {
          title: "Hizmetin kapsamı",
          body: <p>Kuzens; sunucu, metin ve ses odaları, mesajlaşma, bağlantı önizlemeleri, rol/yetki yönetimi ve ekran paylaşımı araçları sunar. Ücretsiz geliştirme sürümünde özellikler değişebilir veya geçici olarak kullanılamayabilir.</p>,
        },
        {
          title: "Kullanıcı içerikleri",
          body: <p>Paylaştığın içeriğin hakları sende kalır. İçeriğin diğer kullanıcılara iletilmesi, saklanması ve teknik olarak işlenmesi için Kuzens’e yalnızca hizmeti sunmaya yetecek kapsamda, devredilemez nitelikte kullanım izni verirsin.</p>,
        },
        {
          title: "Yasak kullanımlar",
          body: <ul><li>Yasa dışı içerik, tehdit, taciz veya nefret söylemi</li><li>Başkasının kişisel verisini izinsiz paylaşma</li><li>Zararlı yazılım, kimlik avı, spam veya hizmeti bozma girişimi</li><li>Başkasını taklit etme ve telif hakkı ihlali</li></ul>,
        },
        {
          title: "Moderasyon ve yaptırımlar",
          body: <p>İhlalin ağırlığına göre içerik kaldırılabilir, özellikler kısıtlanabilir, hesap askıya alınabilir veya kapatılabilir. Acil güvenlik ve yasal yükümlülük hâllerinde önceden bildirim yapılmayabilir; diğer durumlarda gerekçe kullanıcıya açıklanır.</p>,
        },
        {
          title: "Süreklilik ve sorumluluk sınırı",
          body: <p>Hizmet makul güvenlik ve süreklilik hedefiyle sunulur; kesintisiz veya hatasız çalışma garantisi verilmez. Emredici hukuk kuralları saklı kalmak üzere, dolaylı kayıplardan sorumluluk kabul edilmez.</p>,
        },
        {
          title: "Değişiklik ve uygulanacak hukuk",
          body: <p>Esaslı değişiklikler yürürlüğe girmeden önce duyurulur ve gerekiyorsa yeniden kabul alınır. Koşullara Türkiye Cumhuriyeti hukuku uygulanır; emredici tüketici ve kişisel veri hükümleri saklıdır.</p>,
        },
      ]}
    />
  );
}
