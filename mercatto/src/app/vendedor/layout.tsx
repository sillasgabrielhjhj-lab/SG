import Link from "next/link";
import { LayoutDashboard, Package, ShoppingBag, Star } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { requireUser } from "@/lib/auth/guards";
import { getSellerByUserId } from "@/lib/data/seller";

const navItems = [
  { href: "/vendedor", label: "Visão geral", icon: LayoutDashboard },
  { href: "/vendedor/produtos", label: "Produtos", icon: Package },
  { href: "/vendedor/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/vendedor/avaliacoes", label: "Avaliações", icon: Star },
];

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/entrar");
  const seller = await getSellerByUserId(user.id);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page py-8">
          {seller ? (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
              <aside>
                <p className="mb-3 truncate px-3 text-sm font-semibold text-foreground">
                  {seller.storeName}
                </p>
                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </aside>
              <div>{children}</div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
