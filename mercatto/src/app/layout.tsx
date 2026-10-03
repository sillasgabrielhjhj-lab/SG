import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Mercatto é o marketplace onde você encontra milhares de produtos de vendedores verificados, com entrega rápida e compra protegida.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Mercatto — Compre e venda com confiança",
    template: "%s | Mercatto",
  },
  description: DESCRIPTION,
  openGraph: {
    siteName: "Mercatto",
    locale: "pt_BR",
    type: "website",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mercatto",
  url: APP_URL,
  description: DESCRIPTION,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jakarta.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
