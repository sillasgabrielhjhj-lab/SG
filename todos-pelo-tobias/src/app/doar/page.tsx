import { ArrowLeft, Lock, QrCode, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DonationFlow } from "@/components/donate/DonationFlow";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { campaign, pixSetup } from "@/config/campaign";
import { coverPhoto } from "@/content/photos";
import { getSiteUrl } from "@/lib/site-url";

const title = "Ajude o Tobias com qualquer valor ❤️";
const description =
  "Escolha um valor e doe por Pix com QR Code ou Pix Copia e Cola, direto no aplicativo do seu banco.";

export const metadata: Metadata = {
  title: "Doe por Pix",
  description,
  alternates: { canonical: "/doar" },
  openGraph: { type: "website", locale: "pt_BR", siteName: campaign.name, url: "/doar", title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function DonatePage() {
  return (
    <>
      <SiteHeader variant="donate" />
      <main id="conteudo" className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-14">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand-800 transition hover:text-brand-600"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Voltar à campanha
            </Link>
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] bg-white shadow-lift ring-[5px] ring-white lg:aspect-[4/5]">
              <PhotoFrame photo={coverPhoto} sizes="(min-width: 1024px) 440px, 100vw" priority />
            </div>
            <h1 className="mt-7 text-[2rem] leading-[1.1] font-black text-brand-950 sm:text-4xl lg:text-[2.6rem]">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Esta é uma campanha solidária para ajudar o Tobias. Escolha um valor, gere o QR Code Pix ou copie o
              código e pague no aplicativo do seu banco. Todo gesto de carinho faz a diferença.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm font-semibold text-brand-900">
              <li className="flex items-center gap-2.5">
                <QrCode aria-hidden className="size-4 text-brand-600" /> QR Code e Pix Copia e Cola gerados na hora
              </li>
              <li className="flex items-center gap-2.5">
                <Smartphone aria-hidden className="size-4 text-brand-600" /> O pagamento é feito no app do seu banco
              </li>
              <li className="flex items-center gap-2.5">
                <Lock aria-hidden className="size-4 text-brand-600" /> Não pedimos senhas nem dados bancários
              </li>
            </ul>
          </div>

          <div>
            <DonationFlow
              setup={pixSetup}
              presetsCents={campaign.donation.presetsCents}
              minCents={campaign.donation.minCents}
              maxCents={campaign.donation.maxCents}
              siteUrl={getSiteUrl()}
            />
            <div className="mt-8 text-center">
              <Link href="/" className={btn({ variant: "secondary", size: "md", className: "w-full sm:w-auto" })}>
                <ArrowLeft aria-hidden className="size-4" />
                Voltar à campanha
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
