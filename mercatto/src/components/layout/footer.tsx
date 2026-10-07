import Link from "next/link";
import { Headphones, Lock, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SocialIcon } from "@/components/layout/social-icons";

const COLUMNS = [
  { title: "Mercatto", links: [["Sobre a Mercatto", "/sobre"], ["Oficial Mercatto", "/oficial"], ["Ofertas do dia", "/ofertas"], ["Todas as categorias", "/categorias"]] },
  { title: "Ajuda", links: [["Central de ajuda", "/ajuda"], ["Fale conosco", "/contato"], ["Trocas e devoluções", "/trocas-e-devolucoes"], ["Meus pedidos", "/minha-conta/pedidos"]] },
  { title: "Vender", links: [["Vender na Mercatto", "/vender"], ["Painel do vendedor", "/vendedor"], ["Regras para vendedores", "/termos#vendedores"]] },
  { title: "Segurança e privacidade", links: [["Compra segura", "/seguranca"], ["Termos de uso", "/termos"], ["Política de privacidade", "/privacidade"], ["Política de cookies", "/cookies"]] },
] as const;

const PAYMENTS = ["PIX", "Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

export function Footer({ social, sandbox, contactEmail }: { social: Record<string, string | null> | null; sandbox: boolean; contactEmail?: string | null }) {
  const socials = Object.entries(social ?? {}).filter(([, url]) => Boolean(url)) as [string, string][];
  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <div data-footer-trust className="border-b border-line">
        <ul className="container-page grid grid-cols-2 gap-4 py-6 md:grid-cols-5">
          {[
            [ShieldCheck, "Compra segura", "Seus dados protegidos"],
            [Lock, "Pagamento protegido", "PIX e cartão"],
            [Truck, "Entrega rápida", "Para todo o Brasil"],
            [RotateCcw, "Devolução fácil", "Até 7 dias após receber"],
            [Headphones, "Suporte de verdade", "Atendimento humano"],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <li key={String(title)} className="flex items-center gap-3 last:max-md:col-span-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <I className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">{String(title)}</span>
                  <span className="text-xs text-fg-muted">{String(text)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
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
          {contactEmail ? <p className="text-xs text-fg-subtle">Atendimento: {contactEmail}</p> : null}
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
        <div className="container-page flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold text-fg-muted">Formas de pagamento</p>
            <ul className="flex flex-wrap gap-1.5">
              {PAYMENTS.map((p) => (
                <li key={p} className="rounded-md border border-line bg-surface px-2 py-1 text-2xs font-bold tracking-wide text-fg-muted">
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-fg-subtle">
            © {new Date().getFullYear()} Mercatto. Todos os direitos reservados.
            {sandbox ? " · Ambiente de demonstração." : ""}
          </p>
        </div>
      </div>
    </footer>
  );
}
