import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/#conheca-tobias", label: "Conheça Tobias" },
  { href: "/#fotos", label: "Fotos" },
  { href: "/#como-ajudar", label: "Como ajudar" },
  { href: "/doar", label: "Doar agora" },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200">
            Campanha solidária para ajudar o Tobias. As doações são feitas exclusivamente por Pix,
            direto no aplicativo do seu banco.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <p className="text-sm font-bold tracking-[0.16em] text-brand-300 uppercase">Navegação</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-brand-100 transition hover:text-white hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-bold tracking-[0.16em] text-brand-300 uppercase">Segurança</p>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Nunca pedimos senhas, códigos de verificação ou dados do seu cartão. Antes de confirmar
            o Pix, confira no app do seu banco o nome do recebedor e o valor.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} Todos pelo Tobias · Feito com carinho ❤️
      </div>
    </footer>
  );
}
