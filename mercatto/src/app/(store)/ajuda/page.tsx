import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { FAQ } from "@/features/help/faq";
import { HelpCenter } from "@/features/help/components/help-center";

export const metadata = buildMetadata({ title: "Central de ajuda", description: "Respostas sobre compras, pagamentos PIX e cartão, entregas, trocas, garantia, cupons e segurança na Mercatto.", path: "/ajuda" });

export default function HelpPage() {
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Central de ajuda</h1>
      <p className="mt-2 text-fg-muted">
        Não encontrou o que precisa? <Link href="/contato" className="font-semibold text-brand-700 underline">Fale com a gente</Link>.
      </p>
      <HelpCenter groups={FAQ} />
    </div>
  );
}
