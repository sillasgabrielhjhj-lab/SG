import Link from "next/link";

import { Logo } from "@/components/layout/logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <div className="container-page flex justify-center pt-8">
        <Link href="/" aria-label="Página inicial da Mercatto">
          <Logo />
        </Link>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}

          <div className="mt-6">{children}</div>

          {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
