import { BadgeCheck, Landmark, Mail, QrCode, ScanSearch, ShieldCheck, Target } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { campaign, pixSetup } from "@/config/campaign";

function contactChannels() {
  const { email, whatsapp, instagram } = campaign.contact;
  const handle = instagram.replace(/^@/, "").trim();
  const phone = whatsapp.replace(/\D/g, "");
  return [
    email && { href: `mailto:${email}`, label: email, icon: Mail },
    phone && { href: `https://wa.me/${phone}`, label: "WhatsApp da organização", icon: WhatsAppIcon },
    handle && { href: `https://instagram.com/${handle}`, label: `@${handle}`, icon: InstagramIcon },
  ].filter((channel) => Boolean(channel)) as { href: string; label: string; icon: typeof Mail }[];
}

export function Trust() {
  const channels = contactChannels();
  const receiver = pixSetup.status === "ready" && !pixSetup.isPlaceholder ? pixSetup : null;

  const points = [
    {
      icon: Target,
      title: "Finalidade da campanha",
      text: "Arrecadar doações voluntárias para ajudar o Tobias. Toda contribuição é espontânea.",
    },
    {
      icon: QrCode,
      title: "Como doar e por onde",
      text: "Você escolhe o valor, gera o QR Code (ou copia o código) e paga no aplicativo do seu banco. As contribuições são enviadas exclusivamente por Pix.",
    },
    {
      icon: ScanSearch,
      title: "Confira o beneficiário antes de pagar",
      text: `Na tela de confirmação do seu banco, confira o nome do recebedor${receiver ? ` (${receiver.receiverName})` : ""} e o valor. Se algo estiver diferente, não conclua o pagamento.`,
    },
    {
      icon: ShieldCheck,
      title: "O que nunca pedimos",
      text: "Senhas, códigos de verificação, dados de cartão ou de conta bancária. Desconfie de qualquer mensagem que peça isso em nome da campanha.",
    },
    {
      icon: BadgeCheck,
      title: "Sem números inventados",
      text: "Este site não exibe valores arrecadados porque o Pix vai direto do seu banco ao recebedor. Só mostraremos totais que possam ser comprovados.",
    },
  ];

  return (
    <section id="transparencia" aria-labelledby="confianca-titulo" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow="Transparência" title="Doe com tranquilidade" id="confianca-titulo">
          Veja como a campanha funciona e como conferir tudo antes de confirmar o seu Pix.
        </SectionHeading>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <ul className="space-y-4">
            {points.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 80}>
                  <div className="flex gap-4 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-100 sm:p-6">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <div>
                      <h3 className="text-xl font-extrabold text-brand-950">{title}</h3>
                      <p className="mt-1.5 leading-relaxed text-muted">{text}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <div className="space-y-6">
            <Reveal>
              <div className="rounded-3xl bg-brand-950 p-6 text-white shadow-lift sm:p-7">
                <p className="flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-brand-300 uppercase">
                  <Landmark aria-hidden className="size-4" /> Chave Pix oficial
                </p>
                <p className="mt-3 text-lg font-bold break-all">{campaign.pix.key}</p>
                {receiver ? (
                  <p className="mt-2 text-sm text-brand-200">
                    Recebedor: {receiver.receiverName} · {receiver.receiverCity}
                  </p>
                ) : null}
                <div className="mt-5">
                  <CopyButton
                    text={campaign.pix.key}
                    label="Copiar chave Pix"
                    copiedLabel="Chave copiada!"
                    failureHint="Não foi possível copiar. Selecione a chave acima e copie."
                    variant="secondary"
                    size="md"
                    className="w-full"
                  />
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-brand-100 sm:p-7">
                <h3 className="text-xl font-extrabold text-brand-950">Fale com a organização</h3>
                {channels.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {channels.map(({ href, label, icon: Icon }) => (
                      <li key={href}>
                        <a
                          href={href}
                          target={href.startsWith("mailto:") ? undefined : "_blank"}
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-2xl px-3 py-3 font-semibold break-all text-brand-800 transition hover:bg-brand-50"
                        >
                          <Icon aria-hidden className="size-5 shrink-0" />
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 leading-relaxed text-muted">
                    Os canais de contato da organização serão divulgados em breve.
                  </p>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
