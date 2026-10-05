import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listUserQuestions } from "@/features/questions/queries";
import { ProductImage } from "@/components/commerce/product-image";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatRelative } from "@/lib/format";

export const metadata = { title: "Perguntas" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUserPage("/minha-conta/perguntas");
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const data = await listUserQuestions(user.id, page);
  return (
    <div>
      <PageHeading title="Perguntas" description="Perguntas que você fez aos vendedores." />
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<MessageCircleQuestion />} title="Nenhuma pergunta ainda" description="Tire dúvidas diretamente com o vendedor na página do produto." />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((q) => (
            <li key={q.id} className="flex gap-3 rounded-card border border-line bg-surface p-4">
              <Link href={`/produto/${q.product.slug}#perguntas`} className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-white focus-ring">
                <ProductImage src={q.product.images[0]?.url ?? null} alt="" sizes="56px" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/produto/${q.product.slug}#perguntas`} className="line-clamp-1 text-xs font-semibold text-fg-muted hover:underline">
                  {q.product.name}
                </Link>
                <p className="mt-1 text-sm font-medium">{q.body}</p>
                <p className="text-xs text-fg-subtle">{formatRelative(q.createdAt)}</p>
                {q.answer ? (
                  <div className="mt-2 border-l-2 border-brand-300 pl-3 text-sm text-fg-muted">
                    <span className="font-semibold text-fg">Resposta do vendedor: </span>
                    {q.answer.body}
                  </div>
                ) : q.status === "REJECTED" ? (
                  <Badge tone="danger" size="xs" className="mt-2">
                    Não publicada
                  </Badge>
                ) : (
                  <Badge tone="warning" size="xs" className="mt-2">
                    Aguardando resposta
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={page} totalPages={data.totalPages} buildHref={(p) => `/minha-conta/perguntas${p > 1 ? `?pagina=${p}` : ""}`} />
    </div>
  );
}
