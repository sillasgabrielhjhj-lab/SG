import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { campaign } from "@/config/campaign";
import { getSiteUrl } from "@/lib/site-url";

const title = `${campaign.name} — Campanha solidária`;
const description =
  "Campanha solidária para ajudar o Tobias. Doe qualquer valor por Pix, direto no app do seu banco, ou ajude compartilhando.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: title, template: `%s | ${campaign.name}` },
  description,
  applicationName: campaign.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: campaign.name,
    title: `${campaign.name} ❤️`,
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: `${campaign.name} ❤️`, description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#258454",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-svh antialiased">
        <a
          href="#conteudo"
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-full bg-brand-900 px-5 py-3 text-sm font-bold text-white transition focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
