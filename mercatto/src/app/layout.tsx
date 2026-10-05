import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";
import { resolveAppUrl } from "@/lib/app-url";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

const jakarta = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2", style: "normal", weight: "200 800" },
    { path: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-wght-normal.woff2", style: "normal", weight: "200 800" },
  ],
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial"],
});

export const metadata: Metadata = {
  metadataBase: new URL(resolveAppUrl()),
  title: { default: "Mercatto — compre com confiança", template: "%s | Mercatto" },
  description: "Marketplace brasileiro com ofertas oficiais Mercatto e lojas parceiras verificadas. PIX, parcelamento e entrega para todo o Brasil.",
  applicationName: "Mercatto",
  appleWebApp: { capable: true, title: "Mercatto", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b5c4d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
