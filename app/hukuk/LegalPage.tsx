import Link from "next/link";
import type { ReactNode } from "react";
import "./legal.css";

export type LegalSection = {
  title: string;
  body: ReactNode;
};

export function LegalPage({
  title,
  summary,
  sections,
  statusNote,
}: {
  title: string;
  summary: string;
  sections: LegalSection[];
  statusNote?: string;
}) {
  return (
    <main className="legal-page">
      <header className="legal-topbar">
        <Link className="legal-brand" href="/">
          K<span>.</span> <strong>Kuzens</strong>
        </Link>
        <nav aria-label="Hukuk merkezi">
          <Link href="/hukuk">Hukuk merkezi</Link>
          <Link href="/">Uygulamaya dön</Link>
        </nav>
      </header>

      <div className="legal-layout">
        <aside className="legal-side">
          <span className="legal-kicker">GÜVEN & ŞEFFAFLIK</span>
          <nav>
            <Link href="/hukuk/kullanim-kosullari">Kullanım Koşulları</Link>
            <Link href="/hukuk/aydinlatma">KVKK Aydınlatma Metni</Link>
            <Link href="/hukuk/gizlilik">Gizlilik Politikası</Link>
            <Link href="/hukuk/topluluk-kurallari">Topluluk Kuralları</Link>
            <Link href="/hukuk/cerez">Çerez Politikası</Link>
            <Link href="/hukuk/basvuru">KVKK Başvuru Merkezi</Link>
          </nav>
        </aside>

        <article className="legal-document">
          <div className="legal-title">
            <span>Sürüm 1.0 · 25 Temmuz 2026</span>
            <h1>{title}</h1>
            <p>{summary}</p>
          </div>

          {statusNote && (
            <div className="legal-status">
              <strong>Yayın öncesi kimlik doğrulaması</strong>
              <p>{statusNote}</p>
            </div>
          )}

          <div className="legal-sections">
            {sections.map((section, index) => (
              <section key={section.title} id={`madde-${index + 1}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{section.title}</h2>
                  <div className="legal-body">{section.body}</div>
                </div>
              </section>
            ))}
          </div>

          <footer className="legal-footer">
            <p>Bu metnin güncel sürümü her zaman bu adreste yayımlanır.</p>
            <Link href="/hukuk/basvuru">Bir gizlilik talebi oluştur →</Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
