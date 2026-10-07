import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SocialIcon } from "@/components/layout/social-icons";
import { BENEFIT_ICONS } from "@/features/home/components/benefits-bar";
import type { StoreBenefit } from "@/features/home/benefits.server";
import { formatPhone } from "@/lib/format";

const COLUMNS = [
  { title: "Mercatto", links: [["Sobre a Mercatto", "/sobre"], ["Oficial Mercatto", "/oficial"], ["Ofertas do dia", "/ofertas"], ["Todas as categorias", "/categorias"]] },
  { title: "Ajuda", links: [["Central de ajuda", "/ajuda"], ["Como comprar", "/ajuda#compras"], ["Fale conosco", "/contato"], ["Trocas e devoluções", "/trocas-e-devolucoes"], ["Meus pedidos", "/minha-conta/pedidos"]] },
  { title: "Vender", links: [["Vender na Mercatto", "/vender"], ["Painel do vendedor", "/vendedor"], ["Regras para vendedores", "/termos#vendedores"]] },
  { title: "Segurança e privacidade", links: [["Compra segura", "/seguranca"], ["Termos de uso", "/termos"], ["Política de privacidade", "/privacidade"], ["Política de cookies", "/cookies"]] },
] as const;

export type FooterCompany = {
  legalName: string | null;
  document: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  hours: string | null;
};

/**
 * Rodapé. Vantagens e formas de pagamento vêm da configuração real (mesma
 * fonte da faixa de benefícios da home); os dados da empresa só aparecem
 * quando preenchidos em Admin → Configurações.
 */
export function Footer({ social, sandbox, company, benefits, paymentMethods }: { social: Record<string, string | null> | null; sandbox: boolean; company: FooterCompany; benefits: StoreBenefit[]; paymentMethods: string[] }) {
  const socials = Object.entries(social ?? {}).filter(([, url]) => Boolean(url)) as [string, string][];
  const payments = [paymentMethods.includes("PIX") ? "PIX" : null, paymentMethods.includes("CREDIT_CARD") ? "Cartão de crédito" : null].filter((p): p is string => p !== null);
  const contact = [company.email, company.phone ? formatPhone(company.phone) : null, company.hours].filter((c): c is string => Boolean(c));
  return (
    <footer className="mt-12 border-t border-line bg-surface">
      {benefits.length ? (
        <div data-footer-trust className="border-b border-line">
          <ul className="container-page grid grid-cols-2 gap-4 py-6 md:grid-cols-5">
            {benefits.map((b) => {
              const Icon = BENEFIT_ICONS[b.key];
              return (
                <li key={b.key} className="flex items-center gap-3 last:max-md:col-span-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-fg">{b.title}</span>
                    <span className="text-xs text-fg-muted">{b.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-sm text-fg-muted">Marketplace brasileiro com ofertas oficiais Mercatto e lojas parceiras verificadas.</p>
          {socials.length ? (
            <ul className="flex gap-2" aria-label="Redes sociais">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-full border border-line text-fg-muted hover:border-brand-400 hover:text-brand-700 focus-ring" aria-label={name}>
                    <SocialIcon name={name} className="size-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {contact.length ? (
            <p className="text-xs leading-relaxed text-fg-muted">
              <span className="font-semibold text-fg">Atendimento:</span> {contact.join(" · ")}
            </p>
          ) : null}
        </div>
        {COLUMNS.map((col) => (
          <details key={col.title} className="group border-b border-line pb-3 lg:border-0 lg:pb-0" open>
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-fg lg:cursor-default [&::-webkit-details-marker]:hidden">
              {col.title}
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-fg-muted hover:text-brand-700 hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <div className="border-t border-line bg-surface-muted">
        <div className="container-page flex flex-col gap-4 py-5 md:flex-row md:items-end md:justify-between">
          {payments.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-fg-muted">Formas de pagamento</p>
              <ul className="flex flex-wrap gap-1.5">
                {payments.map((p) => (
                  <li key={p} className="rounded-md border border-line bg-surface px-2 py-1 text-2xs font-bold tracking-wide text-fg-muted">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 text-xs text-fg-subtle md:text-right">
            {company.legalName || company.document ? (
              <p>{[company.legalName, company.document ? `CNPJ ${company.document}` : null].filter(Boolean).join(" · ")}</p>
            ) : null}
            {company.address ? <p>{company.address}</p> : null}
            <p>
              © {new Date().getFullYear()} {company.legalName ?? "Mercatto"}. Todos os direitos reservados.
              {sandbox ? " · Ambiente de demonstração." : ""}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
