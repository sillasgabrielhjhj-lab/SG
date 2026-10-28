import {
  CalendarHeart,
  ClipboardList,
  HandHeart,
  Landmark,
  Mail,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { CopyButton } from "@/components/ui/CopyButton";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pixSetup } from "@/config/pix";
import { transparency } from "@/content/transparency";
import { formatDateBR } from "@/lib/fundraising/messages";

function contactChannels() {
  const { email, whatsapp, instagram } = transparency.contact;
  const handle = instagram.replace(/^@/, "").trim();
  const phone = whatsapp.replace(/\D/g, "");
  return [
    email && { href: `mailto:${email}`, label: email, icon: Mail },
    phone && { href: `https://wa.me/${phone}`, label: "WhatsApp oficial", icon: WhatsAppIcon },
    handle && { href: `https://instagram.com/${handle}`, label: `@${handle}`, icon: InstagramIcon },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Mail }[];
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="h-full rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-petal-100 sm:p-7">
      <h3 className="flex items-center gap-3 text-xl font-semibold text-ink">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-lilac-100 text-lilac-700">
          <Icon aria-hidden className="size-5" />
        </span>
        {title}
      </h3>
      <div className="mt-4 leading-relaxed text-muted">{children}</div>
    </div>
  );
}

const Soon = ({ children }: { children: ReactNode }) => (
  <p className="rounded-2xl border border-dashed border-petal-200 bg-petal-50/50 p-4 text-sm">
    {children}
  </p>
);

/** "Sua ajuda faz a diferença": finalidade, responsáveis, dados verificáveis, contato e atualizações. */
export function Transparency() {
  const { organizers, facts, updates } = transparency;
  const channels = contactChannels();
  const receiver = pixSetup?.receiver;

  const safety = [
    {
      icon: ScanSearch,
      title: "Confira o beneficiário antes de pagar",
      text: `Na tela de confirmação do seu banco, confira o nome do beneficiário${receiver ? ` (${receiver.name})` : ""} e o valor. Se algo estiver diferente, não conclua o pagamento.`,
    },
    {
      icon: ShieldCheck,
      title: "O que nunca pedimos",
      text: "Senhas, códigos de verificação, dados de cartão ou de conta bancária. Desconfie de qualquer mensagem que peça isso em nome da campanha.",
    },
    {
      icon: ClipboardList,
      title: "Sobre o valor arrecadado",
      text: "Os valores da meta são informados pelos responsáveis e atualizados manualmente. Este site não consulta o banco nem confirma pagamentos: escolher um valor ou copiar o código Pix não altera o total.",
    },
  ];

  return (
    <section
      id="transparencia"
      aria-labelledby="transparencia-titulo"
      className="scroll-mt-20 bg-sand/60 py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Transparência"
          title="Sua ajuda faz a diferença"
          id="transparencia-titulo"
        >
          As doações têm o objetivo de apoiar os cuidados e o acompanhamento da May, conforme
          informado pela campanha. Aqui você encontra quem organiza a arrecadação, como conferir os
          dados e as novidades.
        </SectionHeading>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <Panel icon={Users} title="Responsáveis pela arrecadação">
              {organizers.length > 0 ? (
                <ul className="space-y-3">
                  {organizers.map((person) => (
                    <li key={person.name}>
                      <p className="font-bold text-ink">
                        {person.name}
                        {person.role ? (
                          <span className="font-medium text-muted"> · {person.role}</span>
                        ) : null}
                      </p>
                      {person.about ? <p className="mt-0.5 text-sm">{person.about}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Soon>
                  As informações sobre os responsáveis pela arrecadação serão publicadas aqui.
                </Soon>
              )}
            </Panel>
          </Reveal>

          <Reveal delay={80}>
            <Panel icon={Landmark} title="Dados da campanha">
              {pixSetup || facts.length > 0 ? (
                <>
                  <dl className="space-y-3">
                    {pixSetup ? (
                      <div>
                        <dt className="text-xs font-bold tracking-[0.14em] text-petal-700 uppercase">
                          Chave Pix oficial
                        </dt>
                        <dd className="mt-0.5 font-semibold [overflow-wrap:anywhere] text-ink">
                          {pixSetup.key}
                        </dd>
                      </div>
                    ) : null}
                    {receiver ? (
                      <div>
                        <dt className="text-xs font-bold tracking-[0.14em] text-petal-700 uppercase">
                          Beneficiário
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {receiver.name}
                          {receiver.city ? ` · ${receiver.city}` : ""}
                        </dd>
                      </div>
                    ) : null}
                    {facts.map(({ label, value }) => (
                      <div key={label}>
                        <dt className="text-xs font-bold tracking-[0.14em] text-petal-700 uppercase">
                          {label}
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {pixSetup ? (
                    <div className="mt-5">
                      <CopyButton
                        text={pixSetup.key}
                        label="Copiar chave Pix"
                        copiedLabel="Chave copiada!"
                        failureHint="Não foi possível copiar. Selecione a chave acima e copie."
                        variant="secondary"
                        size="md"
                        className="w-full"
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <Soon>
                  A chave Pix oficial e os dados verificáveis da campanha serão publicados aqui.
                </Soon>
              )}
            </Panel>
          </Reveal>

          <Reveal>
            <Panel icon={HandHeart} title="Contato oficial">
              {channels.length > 0 ? (
                <ul className="space-y-1">
                  {channels.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <a
                        href={href}
                        target={href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 font-semibold break-all text-petal-800 transition hover:bg-petal-50"
                      >
                        <Icon aria-hidden className="size-5 shrink-0" />
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Soon>Os canais oficiais de contato da campanha serão divulgados aqui.</Soon>
              )}
            </Panel>
          </Reveal>

          <Reveal delay={80}>
            <Panel icon={CalendarHeart} title="Atualizações">
              {updates.length > 0 ? (
                <ol className="space-y-4 border-l-2 border-petal-100 pl-5">
                  {updates.map((update) => (
                    <li key={`${update.date}-${update.title}`} className="relative">
                      <span
                        aria-hidden
                        className="absolute top-1.5 -left-[1.6rem] size-3 rounded-full bg-petal-400 ring-4 ring-white"
                      />
                      <p className="text-xs font-bold text-petal-700">
                        <time dateTime={update.date}>{formatDateBR(update.date)}</time>
                      </p>
                      <p className="font-bold text-ink">{update.title}</p>
                      <p className="mt-0.5 text-sm">{update.text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <Soon>
                  Nenhuma atualização publicada ainda. As novidades serão compartilhadas aqui pelos
                  responsáveis.
                </Soon>
              )}
            </Panel>
          </Reveal>
        </div>

        <ul className="mt-5 grid gap-5 md:grid-cols-3">
          {safety.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={i * 80} className="h-full">
                <div className="h-full rounded-[2rem] bg-white/70 p-6 ring-1 ring-petal-100">
                  <Icon aria-hidden className="size-6 text-sage-600" />
                  <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
