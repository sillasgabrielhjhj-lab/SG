import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  PackageCheck,
  ShoppingBag,
  FolderTree,
  Ticket,
  Star,
  Truck,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { requireRole } from "@/lib/auth/guards";

const navItems = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/vendedores", label: "Vendedores", icon: Store },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/produtos-mercatto", label: "Produtos do Mercatto", icon: PackageCheck },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/pedidos-mercatto", label: "Pedidos do Mercatto", icon: Truck },
  { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { href: "/admin/cupons", label: "Cupons", icon: Ticket },
  { href: "/admin/avaliacoes", label: "Avaliações", icon: Star },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN"]);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
            <aside>
              <p className="mb-3 px-3 text-sm font-semibold text-foreground">Administração</p>
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
        </div>
      </main>
      <Footer />
    </>
  );
}
