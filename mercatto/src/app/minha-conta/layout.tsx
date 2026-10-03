import Link from "next/link";
import { User, Package, MapPin, Heart, ShieldCheck } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { requireUser } from "@/lib/auth/guards";

const navItems = [
  { href: "/minha-conta", label: "Meus dados", icon: User },
  { href: "/minha-conta/pedidos", label: "Pedidos", icon: Package },
  { href: "/minha-conta/enderecos", label: "Endereços", icon: MapPin },
  { href: "/minha-conta/favoritos", label: "Favoritos", icon: Heart },
  { href: "/minha-conta/seguranca", label: "Segurança", icon: ShieldCheck },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/entrar");

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page grid grid-cols-1 gap-8 py-8 lg:grid-cols-[220px_1fr]">
          <aside>
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
      </main>
      <Footer />
    </>
  );
}
