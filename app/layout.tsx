import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og-aura.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: {
      default: "Kuzens — birlikte kal.",
      template: "%s · Kuzens",
    },
    description:
      "Topluluğun için mesajlaşma, sesli odalar ve ekran paylaşımı.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: "/favicon.svg",
      apple: "/favicon.svg",
    },
    applicationName: "Kuzens",
    appleWebApp: {
      capable: true,
      title: "Kuzens",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: "Kuzens — birlikte kal.",
      description:
        "Arkadaşlarınla kendi alanında konuş, paylaş ve birlikte takıl.",
      type: "website",
      images: [{ url: socialImage, width: 1734, height: 907, alt: "Kuzens — birlikte kal." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Kuzens — birlikte kal.",
      description:
        "Arkadaşlarınla kendi alanında konuş, paylaş ve birlikte takıl.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
