import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NAV } from "./nav";

export function SiteFooter() {
  return (
    <footer className="bg-lilac-950 text-lilac-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-lilac-200">
            Campanha solidária para apoiar os cuidados e o acompanhamento da May. As doações são
            feitas exclusivamente por Pix, direto no aplicativo do seu banco.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <p className="text-xs font-bold tracking-[0.2em] text-petal-300 uppercase">Navegação</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[...NAV, { href: "/#transparencia", label: "Transparência" }].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-white hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-petal-300 uppercase">Segurança</p>
          <p className="mt-4 text-sm leading-relaxed text-lilac-200">
            Nunca pedimos senhas, códigos de verificação ou dados do seu cartão. Antes de confirmar
            o Pix, confira no app do seu banco o nome do beneficiário e o valor.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-lilac-300">
        © {new Date().getFullYear()} Ajude May nessa caminhada · Feito com carinho ❤️
      </div>
    </footer>
  );
}
