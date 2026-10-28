import { ArrowLeft, Lock, QrCode, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DonationFlow } from "@/components/donate/DonationFlow";
import { PixUnavailable } from "@/components/donate/PixUnavailable";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { campaign } from "@/config/campaign";
import { pixSetup } from "@/config/pix";
import { coverPhoto } from "@/content/photos";
import { getSiteUrl } from "@/lib/site-url";

const description =
  "Escolha um valor e doe por Pix com QR Code ou Pix Copia e Cola, direto no aplicativo do seu banco.";

export const metadata: Metadata = {
  title: "Doe por Pix",
  description,
  alternates: { canonical: "/doar" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: campaign.shortName,
    url: "/doar",
    title: "Doe por Pix e ajude May nessa caminhada ❤️",
    description,
  },
};

export default function DonatePage() {
  return (
    <>
      <SiteHeader variant="donate" />
      <main id="conteudo" className="bg-gradient-to-b from-petal-50 via-ivory to-ivory">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-14">
          <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <div className="order-2 lg:order-1">
              <p className="text-xs font-bold tracking-[0.22em] text-petal-700 uppercase">
                Doe por Pix
              </p>
              <h1 className="mt-3 text-[2rem] leading-[1.12] font-semibold text-ink sm:text-4xl lg:text-[2.6rem]">
                Sua solidariedade pode fazer a diferença na caminhada da May ❤️
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                Escolha um valor, gere o QR Code Pix ou copie o código e pague no aplicativo do seu
                banco. Qualquer contribuição ajuda a trazer mais conforto, segurança e qualidade de
                vida para os dias dela.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm font-semibold text-ink/85">
                <li className="flex items-center gap-2.5">
                  <QrCode aria-hidden className="size-4 text-sage-600" /> QR Code e Pix Copia e Cola
                  gerados na hora
                </li>
                <li className="flex items-center gap-2.5">
                  <Smartphone aria-hidden className="size-4 text-sage-600" /> O pagamento é feito no
                  app do seu banco
                </li>
                <li className="flex items-center gap-2.5">
                  <Lock aria-hidden className="size-4 text-sage-600" /> Não pedimos senhas nem dados
                  bancários
                </li>
              </ul>
            </div>
            <div className="relative order-1 aspect-[2/1] overflow-hidden rounded-[2rem] bg-white shadow-lift ring-[5px] ring-white lg:order-2 lg:aspect-[4/3]">
              <PhotoFrame photo={coverPhoto} sizes="(min-width: 1024px) 440px, 100vw" priority />
            </div>
          </div>

          <div>
            {pixSetup ? (
              <DonationFlow
                setup={pixSetup}
                presetsCents={campaign.donation.presetsCents}
                minCents={campaign.donation.minCents}
                maxCents={campaign.donation.maxCents}
              />
            ) : (
              <PixUnavailable siteUrl={getSiteUrl()} />
            )}
            <div className="mt-8 text-center">
              <Link
                href="/"
                className={btn({ variant: "secondary", size: "md", className: "w-full sm:w-auto" })}
              >
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
