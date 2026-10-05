import Link from "next/link";
import { CheckCircle2, MessageCircleQuestion, MessagesSquare } from "lucide-react";
import { requireSellerPage } from "@/server/auth/guards";
import { listStoreQuestions } from "@/features/questions/queries";
import { SellerQuestionList } from "@/features/questions/components/seller-question-list";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export const metadata = { title: "Perguntas" };

type Status = "unanswered" | "answered" | "all";

/** Abas na URL: ?status=respondidas | ?status=todas (padrão: sem resposta). */
const TABS: { status: Status; param?: string; label: string }[] = [
  { status: "unanswered", label: "Sem resposta" },
  { status: "answered", param: "respondidas", label: "Respondidas" },
  { status: "all", param: "todas", label: "Todas" },
];

const EMPTY: Record<Status, { title: string; description: string }> = {
  unanswered: { title: "Nenhuma pergunta sem resposta", description: "Tudo em dia! Quando um cliente perguntar algo em um anúncio seu, ela aparece aqui e você recebe uma notificação." },
  answered: { title: "Nenhuma pergunta respondida ainda", description: "As perguntas que você responder ficam registradas aqui e visíveis nos anúncios." },
  all: { title: "Seus anúncios ainda não receberam perguntas", description: "Descrições completas e fotos de qualidade ajudam a reduzir dúvidas dos clientes." },
};

export default async function SellerQuestionsPage({ searchParams }: { searchParams: Promise<{ status?: string; pagina?: string }> }) {
  const user = await requireSellerPage("/vendedor/perguntas");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.param && t.param === sp.status) ?? TABS[0]!;
  const page = Math.max(1, Math.floor(Number(sp.pagina)) || 1);
  const data = await listStoreQuestions(user.storeId, { status: tab.status, page });

  const href = (t: (typeof TABS)[number], p = 1) => {
    const s = new URLSearchParams();
    if (t.param) s.set("status", t.param);
    if (p > 1) s.set("pagina", String(p));
    const str = s.toString();
    return `/vendedor/perguntas${str ? `?${str}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        className="mb-0"
        title="Perguntas"
        description={data.unanswered ? `${data.unanswered} pergunta(s) aguardando resposta. Responder rápido aumenta suas chances de venda.` : "Nenhuma pergunta aguardando resposta."}
      />

      <Alert tone="info" title="Respostas são públicas">
        Elas aparecem no anúncio para todos os clientes. Não compartilhe telefone, e-mail, links ou redes sociais: o filtro de moderação bloqueia esse tipo de conteúdo e toda a negociação deve acontecer na Mercatto.
      </Alert>

      <nav aria-label="Filtrar perguntas" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = t.status === tab.status;
          return (
            <Link
              key={t.status}
              href={href(t)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus-ring",
                active ? "border-brand-700 text-brand-800" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {t.label}
              {t.status === "unanswered" && data.unanswered ? (
                <span className="rounded-full bg-warning-50 px-1.5 py-px text-xs text-warning-700 tabular">
                  {data.unanswered}
                  <span className="sr-only"> sem resposta</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={tab.status === "unanswered" ? <CheckCircle2 /> : tab.status === "answered" ? <MessagesSquare /> : <MessageCircleQuestion />}
            title={page > 1 ? "Nenhuma pergunta nesta página" : EMPTY[tab.status].title}
            description={page > 1 ? undefined : EMPTY[tab.status].description}
            action={
              page > 1 ? (
                <Link href={href(tab)} className="text-sm font-semibold text-brand-700 hover:underline focus-ring">
                  Voltar para a primeira página
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-fg-muted">
            {data.total} pergunta(s){tab.status === "unanswered" ? " · as mais antigas primeiro" : ""}
          </p>
          <SellerQuestionList items={data.items} />
        </>
      )}

      <Pagination className="mt-2" page={page} totalPages={data.totalPages} buildHref={(p) => href(tab, p)} />
    </div>
  );
}
