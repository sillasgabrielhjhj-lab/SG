import { ArrowRight, Banknote, QrCode, Share2 } from "lucide-react";
import Link from "next/link";
import { ShareButtons } from "@/components/share/ShareButtons";
import { btn } from "@/components/ui/button";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  {
    icon: Banknote,
    title: "Escolha o valor",
    text: "Qualquer valor ajuda. Selecione uma das opções ou digite o valor que preferir.",
  },
  {
    icon: QrCode,
    title: "Pague por Pix",
    text: "Escaneie o QR Code ou use o Pix Copia e Cola no aplicativo do seu banco.",
  },
  {
    icon: Share2,
    title: "Compartilhe",
    text: "Envie a campanha para quem você conhece. Cada pessoa a mais pode fazer a diferença.",
  },
];

export function HowToHelp({ siteUrl }: { siteUrl: string }) {
  return (
    <section id="como-ajudar" aria-labelledby="ajudar-titulo" className="scroll-mt-20 bg-gradient-to-b from-white to-brand-50 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow="Como ajudar" title="Ajudar é simples e leva poucos minutos" id="ajudar-titulo">
          Você escolhe quanto doar e paga por Pix no aplicativo do seu banco.
        </SectionHeading>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={i * 120} className="h-full">
                <div className="relative h-full rounded-3xl bg-white p-7 shadow-soft ring-1 ring-brand-100">
                  <span aria-hidden className="absolute top-5 right-6 font-display text-5xl font-black text-brand-100">
                    {i + 1}
                  </span>
                  <span className="grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgb(27_106_67/0.8)]">
                    <Icon aria-hidden className="size-7" />
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold text-brand-950">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Link href="/doar" className={btn({ size: "lg" })}>
            Quero doar agora
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </div>

        <Reveal className="mt-16">
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-soft ring-1 ring-brand-100 md:p-12">
            <h3 className="mx-auto max-w-2xl text-2xl font-extrabold text-brand-950 sm:text-3xl">
              Se não puder doar, compartilhar também é uma forma de ajudar.
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Mande a campanha para amigos e familiares. Uma mensagem sua pode chegar a quem queira ajudar.
            </p>
            <ShareButtons url={siteUrl} className="mt-8" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
