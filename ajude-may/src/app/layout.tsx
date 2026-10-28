import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "./globals.css";
import { campaign } from "@/config/campaign";
import { getSiteUrl } from "@/lib/site-url";

const description =
  "May convive com uma condição rara e precisa de cuidados constantes, acompanhamento e apoio. Doe qualquer valor por Pix, direto no app do seu banco, ou ajude compartilhando.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${campaign.title} | Campanha solidária`,
    template: `%s | ${campaign.shortName}`,
  },
  description,
  applicationName: campaign.shortName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: campaign.shortName,
    title: campaign.title,
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: campaign.title, description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fff6f8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-svh antialiased">
        <a
          href="#conteudo"
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
