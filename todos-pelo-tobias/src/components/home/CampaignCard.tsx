import { ArrowRight, QrCode, Smartphone } from "lucide-react";
import Link from "next/link";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { Reveal } from "@/components/ui/Reveal";
import { campaign } from "@/config/campaign";
import { coverPhoto } from "@/content/photos";
import { formatBRL } from "@/lib/money";
import { getCampaignTotals } from "@/lib/payments/totals";

/** Card principal da vaquinha: o card inteiro (foto incluída) leva à página de doação. */
export async function CampaignCard() {
  const totals = await getCampaignTotals(); // null enquanto não houver integração com uma API Pix

  return (
    <section aria-labelledby="campanha-titulo" className="mx-auto max-w-6xl px-4 py-12 lg:py-20">
      <Reveal>
        <article className="group relative overflow-hidden rounded-[2rem] bg-white shadow-soft ring-1 ring-brand-100 transition duration-300 focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-1 hover:shadow-lift">
          <div className="grid md:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[26rem]">
              <PhotoFrame
                photo={coverPhoto}
                index={1}
                sizes="(min-width: 768px) 560px, 100vw"
                className="transition duration-700 group-hover:scale-105"
              />
              <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-extrabold tracking-wide text-brand-800 shadow-sm backdrop-blur">
                CAMPANHA SOLIDÁRIA
              </span>
            </div>
            <div className="flex flex-col justify-center gap-5 p-7 sm:p-10 lg:p-12">
              <h2 id="campanha-titulo" className="text-3xl font-black text-brand-950 sm:text-4xl">
                {campaign.name.toUpperCase()}
              </h2>
              <p className="text-lg leading-relaxed text-muted">{campaign.description}</p>
              {totals ? (
                <p className="text-sm font-semibold text-brand-800">
                  Arrecadado até agora: <strong>{formatBRL(totals.raisedCents)}</strong>
                </p>
              ) : null}
              <ul className="flex flex-wrap gap-2 text-xs font-bold text-brand-800">
                <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 ring-1 ring-brand-100">
                  <QrCode aria-hidden className="size-3.5" /> QR Code Pix
                </li>
                <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 ring-1 ring-brand-100">
                  <Smartphone aria-hidden className="size-3.5" /> Pix Copia e Cola
                </li>
              </ul>
              {/* Link "esticado": o ::after cobre o card inteiro. O <a> não pode ter transform/scale
                  (nem :active), senão ele vira o bloco de referência do overlay e a área clicável encolhe;
                  por isso o visual de botão fica no <span> interno. */}
              <Link href="/doar" className="mt-1 block w-full after:absolute after:inset-0 after:content-[''] sm:w-fit">
                <span className={btn({ size: "lg", className: "w-full transition group-hover:to-brand-800" })}>
                  Fazer uma doação
                  <ArrowRight aria-hidden className="size-5 transition group-hover:translate-x-1" />
                </span>
              </Link>
            </div>
          </div>
        </article>
      </Reveal>
    </section>
  );
}
