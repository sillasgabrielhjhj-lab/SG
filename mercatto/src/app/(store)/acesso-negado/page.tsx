import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acesso negado", robots: { index: false, follow: false } };

export default function AccessDeniedPage() {
  return (
    <div className="container-page flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-warning-50 text-warning-700">
        <ShieldAlert className="size-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">Você não tem acesso a esta área</h1>
      <p className="text-fg-muted">Sua conta não tem permissão para abrir esta página. Se você acredita que isso é um engano, entre com outra conta ou fale com o suporte.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <ButtonLink href="/">Ir para a loja</ButtonLink>
        <ButtonLink href="/minha-conta" variant="outline">
          Minha conta
        </ButtonLink>
        <ButtonLink href="/entrar" variant="ghost">
          Entrar com outra conta
        </ButtonLink>
      </div>
    </div>
  );
}
