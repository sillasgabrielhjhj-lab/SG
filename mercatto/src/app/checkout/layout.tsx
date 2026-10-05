import Link from "next/link";
import { Lock } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AppProviders } from "@/components/providers/app-providers";
import { getCartItemCount } from "@/features/cart/count.server";

/** Layout enxuto do checkout (sem distrações). */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const count = await getCartItemCount();
  return (
    <AppProviders cartCount={count}>
      <header className="bg-brand-800">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="rounded-md focus-ring" aria-label="Mercatto — voltar à loja">
            <Logo tone="inverse" size="sm" />
          </Link>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Lock className="size-4" aria-hidden /> Compra segura
          </span>
        </div>
      </header>
      <main id="conteudo" className="container-page min-h-[70vh] py-5 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-fg-subtle">© Mercatto · Pagamento processado com segurança · Dados protegidos (LGPD)</footer>
    </AppProviders>
  );
}
