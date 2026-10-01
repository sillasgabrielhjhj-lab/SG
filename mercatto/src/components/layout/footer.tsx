import Link from "next/link";
import { Globe, MessageCircle, Mail } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Separator } from "@/components/ui/separator";

const columns = [
  {
    title: "Institucional",
    links: [
      { label: "Sobre a Mercatto", href: "/sobre" },
      { label: "Trabalhe com a gente", href: "/carreiras" },
      { label: "Imprensa", href: "/imprensa" },
      { label: "Sustentabilidade", href: "/sustentabilidade" },
    ],
  },
  {
    title: "Ajuda",
    links: [
      { label: "Central de ajuda", href: "/ajuda" },
      { label: "Como comprar", href: "/ajuda/como-comprar" },
      { label: "Devoluções e reembolsos", href: "/ajuda/devolucoes" },
      { label: "Fale com a gente", href: "/contato" },
    ],
  },
  {
    title: "Venda na Mercatto",
    links: [
      { label: "Comece a vender", href: "/vendedor" },
      { label: "Central do vendedor", href: "/vendedor/ajuda" },
      { label: "Taxas e comissões", href: "/vendedor/taxas" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de uso", href: "/termos" },
      { label: "Política de privacidade", href: "/privacidade" },
      { label: "Propriedade intelectual", href: "/propriedade-intelectual" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              {column.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Separator />

      <div className="container-page flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
        <Logo className="text-foreground" />

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mercatto Comércio Digital. Todos os
          direitos reservados. CNPJ fictício para fins de demonstração.
        </p>

        <div className="flex items-center gap-3 text-muted-foreground">
          <Link href="#" aria-label="Rede social" className="hover:text-primary">
            <Globe className="size-5" />
          </Link>
          <Link href="#" aria-label="Chat" className="hover:text-primary">
            <MessageCircle className="size-5" />
          </Link>
          <Link href="/contato" aria-label="E-mail" className="hover:text-primary">
            <Mail className="size-5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
