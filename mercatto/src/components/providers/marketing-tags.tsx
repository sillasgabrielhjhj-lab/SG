import Script from "next/script";
import { PixelPageViews } from "@/components/providers/pixel-page-views";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID?.trim();
/** Pixel da Mercatto (público). Só no site em produção, para testes e prévias não sujarem os dados. */
const DEFAULT_META_PIXEL_ID = "1126487013153442";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || (process.env.VERCEL_ENV === "production" ? DEFAULT_META_PIXEL_ID : undefined);

/**
 * Google Analytics 4 e Pixel do Meta para tráfego pago. Só carregam quando os
 * IDs estão configurados na Vercel (NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_META_PIXEL_ID);
 * os eventos de e-commerce saem de `trackEvent` (src/lib/analytics.ts).
 */
export function MarketingTags() {
  const ga4 = GA4_ID && /^G-[A-Z0-9]+$/.test(GA4_ID) ? GA4_ID : null;
  const pixel = META_PIXEL_ID && /^\d{6,20}$/.test(META_PIXEL_ID) ? META_PIXEL_ID : null;
  return (
    <>
      {ga4 ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      ) : null}
      {pixel ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
          </Script>
          <PixelPageViews />
        </>
      ) : null}
    </>
  );
}
