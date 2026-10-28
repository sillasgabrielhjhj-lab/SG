import { ArrowRight, Banknote, QrCode, Share2 } from "lucide-react";
import Link from "next/link";
import { ShareButtons } from "@/components/share/ShareButtons";
import { btn } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buildShareMessage } from "@/lib/share";

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
  const message = buildShareMessage(siteUrl);

  return (
    <section
      id="como-ajudar"
      aria-labelledby="ajudar-titulo"
      className="scroll-mt-20 bg-white py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Como ajudar"
          title="Ajudar é simples e leva poucos minutos"
          id="ajudar-titulo"
        >
          Você escolhe quanto doar e paga por Pix no aplicativo do seu banco.
        </SectionHeading>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={i * 120} className="h-full">
                <div className="relative h-full rounded-[2rem] bg-ivory p-7 ring-1 ring-petal-100">
                  <span
                    aria-hidden
                    className="absolute top-5 right-7 font-display text-5xl text-petal-200 italic"
                  >
                    {i + 1}
                  </span>
                  <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-petal-400 to-lilac-500 text-white shadow-soft">
                    <Icon aria-hidden className="size-7" />
                  </span>
                  <h3 className="mt-5 text-2xl font-semibold text-ink">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Link href="/doar" className={btn({ size: "lg" })}>
            FAZER UMA DOAÇÃO
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </div>

        <Reveal className="mt-16">
          <div
            id="compartilhar"
            className="grid scroll-mt-24 gap-10 rounded-[2rem] bg-gradient-to-br from-petal-50 via-white to-lilac-50 p-6 ring-1 ring-petal-100 sm:p-10 lg:grid-cols-[1fr_1fr] lg:items-center"
          >
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-semibold text-ink sm:text-3xl">
                Se não puder doar, compartilhar também é uma forma de ajudar.
              </h3>
              <p className="mt-3 text-muted">
                Envie a campanha para amigos e familiares. Uma mensagem sua pode chegar a quem
                queira ajudar.
              </p>
              <ShareButtons url={siteUrl} className="mt-7 lg:[&>div]:justify-start" />
            </div>
            <figure>
              <figcaption className="text-xs font-bold tracking-[0.16em] text-petal-700 uppercase">
                Texto pronto
              </figcaption>
              <div className="mt-3 rounded-3xl rounded-tl-md bg-[#e7fbd8] p-5 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-line text-[#1f2d1a] shadow-soft">
                {message}
              </div>
              <div className="mt-4">
                <CopyButton
                  text={message}
                  label="Copiar mensagem"
                  copiedLabel="Mensagem copiada!"
                  failureHint="Não foi possível copiar. Selecione o texto acima e copie."
                  variant="secondary"
                  size="md"
                  className="w-full"
                />
              </div>
            </figure>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
