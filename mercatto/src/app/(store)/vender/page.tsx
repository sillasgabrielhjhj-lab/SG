import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, BarChart3, CreditCard, Megaphone, PackageCheck, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { buildMetadata } from "@/features/seo/metadata";
import { StoreProfileForm } from "@/features/seller/components/store-forms";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = buildMetadata({
  title: "Venda na Mercatto",
  description: "Abra sua loja na Mercatto: cadastro simples, pagamentos via PIX e cartão, painel completo de pedidos, estoque e promoções.",
  path: "/vender",
});

const BENEFITS = [
  { icon: CreditCard, title: "Receba com segurança", text: "PIX e cartão com parcelamento processados pela plataforma." },
  { icon: PackageCheck, title: "Gestão completa", text: "Produtos com variações, estoque, pedidos e rastreio em um só painel." },
  { icon: Megaphone, title: "Promoções e cupons", text: "Crie ofertas, ofertas relâmpago e cupons para sua loja." },
  { icon: BarChart3, title: "Métricas reais", text: "Acompanhe vendas, ticket médio, conversão e produtos mais vendidos." },
];

export default async function SellPage() {
  const user = await getCurrentUser();
  if (user?.storeId) redirect("/vendedor");

  return (
    <div className="container-page flex flex-col gap-8 py-6 sm:py-10">
      <section className="grid items-center gap-6 rounded-banner bg-brand-800 p-6 text-white sm:p-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold tracking-wider text-sun-300 uppercase">Mercatto para vendedores</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Sua loja para todo o Brasil</h1>
          <p className="mt-3 max-w-lg text-white/85">Cadastre sua loja em poucos minutos. Após a análise da nossa equipe, seus produtos ficam visíveis para milhares de clientes.</p>
          {!user ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/cadastro?redirect=/vender" variant="sun" size="lg">
                Criar conta e começar
              </ButtonLink>
              <ButtonLink href="/entrar?redirect=/vender" variant="inverse" size="lg">
                Já tenho conta
              </ButtonLink>
            </div>
          ) : null}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b.title} className="rounded-card bg-white/10 p-4">
              <b.icon className="size-6 text-sun-300" aria-hidden />
              <p className="mt-2 font-bold">{b.title}</p>
              <p className="text-sm text-white/80">{b.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {user ? (
        <section aria-labelledby="create-store" className="mx-auto w-full max-w-3xl rounded-panel border border-line bg-surface p-5 sm:p-8">
          <h2 id="create-store" className="text-xl font-extrabold">
            Dados da sua loja
          </h2>
          <p className="mb-5 text-sm text-fg-muted">
            <ShieldCheck className="mr-1 inline size-4 align-[-3px] text-brand-700" aria-hidden />
            Validamos CPF/CNPJ para proteger compradores. Você poderá cadastrar produtos como rascunho enquanto a loja é analisada.
          </p>
          <StoreProfileForm mode="create" />
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Cadastre a loja", "Informe CPF/CNPJ, contato e o CEP de onde você envia."],
          ["2", "Aprovação", "Nossa equipe confere os dados — normalmente em até 2 dias úteis."],
          ["3", "Comece a vender", "Publique produtos, defina frete e acompanhe pedidos pelo painel."],
        ].map(([n, t, d]) => (
          <div key={n} className="flex gap-3 rounded-card border border-line bg-surface p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 font-extrabold text-brand-800">{n}</span>
            <div>
              <p className="font-bold">{t}</p>
              <p className="text-sm text-fg-muted">{d}</p>
            </div>
          </div>
        ))}
      </section>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-fg-subtle">
        <BadgeCheck className="size-4" aria-hidden /> Taxas e condições comerciais são definidas no contrato do vendedor.
      </p>
    </div>
  );
}
