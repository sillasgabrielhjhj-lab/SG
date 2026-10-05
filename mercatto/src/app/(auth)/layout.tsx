import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ToastProvider } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="bg-brand-800">
          <div className="container-page flex h-14 items-center">
            <Link href="/" className="rounded-md focus-ring" aria-label="Mercatto — página inicial">
              <Logo tone="inverse" size="sm" />
            </Link>
          </div>
        </header>
        <main id="conteudo" className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="flex items-center justify-center gap-1.5 py-6 text-xs text-fg-subtle">
          <ShieldCheck className="size-4" aria-hidden /> Seus dados são protegidos conforme a LGPD ·{" "}
          <Link href="/privacidade" className="underline">
            Privacidade
          </Link>
        </footer>
      </div>
    </ToastProvider>
  );
}
