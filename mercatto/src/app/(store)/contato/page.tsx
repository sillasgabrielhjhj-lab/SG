import Link from "next/link";
import { Building2, Clock, HelpCircle, Mail, MessageCircle, Package, Phone, RotateCcw } from "lucide-react";
import { getStoreSettings } from "@/features/settings/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { formatPhone } from "@/lib/format";

export const metadata = buildMetadata({ title: "Contato", description: "Fale com a Mercatto: canais de atendimento para dúvidas sobre pedidos, pagamentos e vendas.", path: "/contato" });

/**
 * Fale conosco: só os canais preenchidos em Admin → Configurações aparecem
 * (nunca uma mensagem de "não configurado"); o autoatendimento está sempre
 * disponível, e os dados da empresa aparecem quando informados.
 */
export default async function ContactPage() {
  const s = await getStoreSettings();
  const digits = (v: string) => v.replace(/\D/g, "");
  const channels = [
    s.whatsapp ? { icon: MessageCircle, label: "WhatsApp", value: formatPhone(s.whatsapp), href: `https://wa.me/55${digits(s.whatsapp)}`, external: true } : null,
    s.contactEmail ? { icon: Mail, label: "E-mail", value: s.contactEmail, href: `mailto:${s.contactEmail}`, external: false } : null,
    s.contactPhone ? { icon: Phone, label: "Telefone", value: formatPhone(s.contactPhone), href: `tel:+55${digits(s.contactPhone)}`, external: false } : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);
  const selfService = [
    { icon: Package, label: "Meus pedidos", text: "Acompanhe entregas, peça cancelamento ou devolução.", href: "/minha-conta/pedidos" },
    { icon: HelpCircle, label: "Central de ajuda", text: "Respostas sobre compra, pagamento, entrega e trocas.", href: "/ajuda" },
    { icon: RotateCcw, label: "Trocas e devoluções", text: "Prazos e como solicitar.", href: "/trocas-e-devolucoes" },
  ];
  const company = [s.companyLegalName, s.companyDocument ? `CNPJ ${s.companyDocument}` : null, s.companyAddress].filter(Boolean);
  const card = "flex h-full items-center gap-3 rounded-card border border-line bg-surface p-4 transition-[box-shadow,border-color] duration-(--motion-base) hover:border-brand-200 hover:shadow-raised focus-ring";
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Fale com a gente</h1>
      <p className="mt-2 text-fg-muted">Para agilizar, tenha em mãos o número do pedido (ex.: MRC-XXXX-XXXX).</p>

      {channels.length ? (
        <section aria-labelledby="channels-title" className="mt-6">
          <h2 id="channels-title" className="text-lg font-bold">Atendimento</h2>
          {s.supportHours ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
              <Clock className="size-4" aria-hidden /> {s.supportHours}
            </p>
          ) : null}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {channels.map((c) => (
              <li key={c.label}>
                <a href={c.href} className={card} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <c.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-fg-muted">{c.label}</span>
                    <span className="block truncate font-semibold">{c.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="self-title" className="mt-8">
        <h2 id="self-title" className="text-lg font-bold">Resolva pelo site</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {selfService.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className={card}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="block text-xs text-fg-muted">{c.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-fg-muted">Dúvida sobre um produto de loja parceira? Use “Perguntar ao vendedor” na página do produto.</p>
      </section>

      {company.length ? (
        <section aria-label="Dados da empresa" className="mt-8 rounded-card bg-surface-muted p-4 text-sm text-fg-muted">
          <p className="flex items-start gap-2">
            <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{company.join(" · ")}</span>
          </p>
        </section>
      ) : null}
    </div>
  );
}
