import Link from "next/link";
import { HelpCircle, Mail, MessageCircle, Phone } from "lucide-react";
import { getStoreSettings } from "@/features/settings/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { formatPhone } from "@/lib/format";

export const metadata = buildMetadata({ title: "Contato", description: "Fale com a Mercatto: canais de atendimento para dúvidas sobre pedidos, pagamentos e vendas.", path: "/contato" });

export default async function ContactPage() {
  const s = await getStoreSettings();
  const channels = [
    s.contactEmail ? { icon: Mail, label: "E-mail", value: s.contactEmail, href: `mailto:${s.contactEmail}` } : null,
    s.contactPhone ? { icon: Phone, label: "Telefone", value: formatPhone(s.contactPhone), href: `tel:+55${s.contactPhone.replace(/\D/g, "")}` } : null,
    s.whatsapp ? { icon: MessageCircle, label: "WhatsApp", value: formatPhone(s.whatsapp), href: `https://wa.me/55${s.whatsapp.replace(/\D/g, "")}` } : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Fale com a gente</h1>
      <p className="mt-2 text-fg-muted">Para agilizar, tenha em mãos o número do pedido (ex.: MRC-XXXX-XXXX). Você também acompanha tudo em “Minha conta”.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {channels.map((c) => (
          <li key={c.label}>
            <a href={c.href} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 hover:shadow-raised focus-ring" {...(c.href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-700">
                <c.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-xs text-fg-muted">{c.label}</span>
                <span className="block font-semibold">{c.value}</span>
              </span>
            </a>
          </li>
        ))}
        <li>
          <Link href="/ajuda" className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 hover:shadow-raised focus-ring">
            <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-700">
              <HelpCircle className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-xs text-fg-muted">Autoatendimento</span>
              <span className="block font-semibold">Central de ajuda</span>
            </span>
          </Link>
        </li>
      </ul>
      {channels.length === 0 ? <p className="mt-4 text-sm text-fg-muted">Os canais de atendimento ainda não foram configurados pela administração.</p> : null}
      <p className="mt-6 text-sm text-fg-muted">
        Dúvidas sobre um produto de loja parceira? Use “Perguntar ao vendedor” na página do produto ou o pedido em <Link href="/minha-conta/pedidos" className="font-semibold text-brand-700 underline">Meus pedidos</Link>.
      </p>
    </div>
  );
}
