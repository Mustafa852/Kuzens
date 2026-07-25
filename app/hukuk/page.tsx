import type { Metadata } from "next";
import Link from "next/link";
import "./legal.css";

export const metadata: Metadata = {
  title: "Hukuk ve Güven Merkezi",
  description: "Kuzens kullanım, gizlilik ve topluluk belgeleri.",
};

const documents = [
  {
    href: "/hukuk/kullanim-kosullari",
    number: "01",
    title: "Kullanım Koşulları",
    text: "Hesap, içerik, hizmet kullanımı ve sorumlulukların açık özeti.",
  },
  {
    href: "/hukuk/aydinlatma",
    number: "02",
    title: "KVKK Aydınlatma Metni",
    text: "Kayıt sırasında hangi verilerin, neden ve hangi hukuki sebeple işlendiği.",
  },
  {
    href: "/hukuk/gizlilik",
    number: "03",
    title: "Gizlilik Politikası",
    text: "Veri saklama, güvenlik, silme ve kullanıcı hakları yaklaşımımız.",
  },
  {
    href: "/hukuk/topluluk-kurallari",
    number: "04",
    title: "Topluluk Kuralları",
    text: "Kuzens’i güvenli, saygılı ve rahat tutan temel davranış kuralları.",
  },
  {
    href: "/hukuk/cerez",
    number: "05",
    title: "Çerez Politikası",
    text: "Reklam ve takip olmadan, yalnızca zorunlu teknik kullanım.",
  },
  {
    href: "/hukuk/basvuru",
    number: "06",
    title: "KVKK Başvuru Merkezi",
    text: "Erişim, düzeltme, silme ve diğer veri hakları için kayıtlı başvuru.",
  },
];

export default function LegalHub() {
  return (
    <main className="legal-page legal-hub">
      <header className="legal-topbar">
        <Link className="legal-brand" href="/">
          K<span>.</span> <strong>Kuzens</strong>
        </Link>
        <Link href="/">Uygulamaya dön</Link>
      </header>

      <section className="hub-hero">
        <span className="legal-kicker">HUKUK & GÜVEN MERKEZİ</span>
        <h1>Kısa, açık ve ulaşılabilir.</h1>
        <p>
          Haklarını saklamıyoruz. Kayıt olmadan önce bilmen gereken her şey,
          sade Türkçeyle burada.
        </p>
      </section>

      <section className="document-grid">
        {documents.map((document) => (
          <Link href={document.href} className="document-card" key={document.href}>
            <span>{document.number}</span>
            <h2>{document.title}</h2>
            <p>{document.text}</p>
            <b>Belgeyi aç →</b>
          </Link>
        ))}
      </section>

      <section className="official-basis">
        <span>RESMÎ DAYANAK</span>
        <p>
          Yapı; 6698 sayılı Kişisel Verilerin Korunması Kanunu, KVKK
          Aydınlatma Tebliği ve Kurumun çerez rehberi temel alınarak hazırlandı.
          Kamuya açılıştan önce veri sorumlusu kimliği ve tebligat bilgileri
          gerçek işletmeci bilgileriyle tamamlanacaktır.
        </p>
      </section>
    </main>
  );
}
