import { requireSellerPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { listStoreReviews } from "@/features/reviews/queries";
import { StoreReviewsFilter, StoreReviewsList, StoreReviewsSummary } from "@/features/reviews/components/store-reviews";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Avaliações" };

const BASE_PATH = "/vendedor/avaliacoes";

export default async function SellerReviewsPage({ searchParams }: { searchParams: Promise<{ nota?: string; pagina?: string }> }) {
  const user = await requireSellerPage(BASE_PATH);
  const sp = await searchParams;
  const nota = Number(sp.nota);
  const rating = Number.isInteger(nota) && nota >= 1 && nota <= 5 ? nota : undefined;
  const page = Math.max(1, Math.floor(Number(sp.pagina)) || 1);
  const [data, store] = await Promise.all([
    listStoreReviews(user.storeId, { page, rating }),
    db.store.findUniqueOrThrow({ where: { id: user.storeId }, select: { ratingAvg: true, ratingCount: true } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading className="mb-0" title="Avaliações" description="O que os clientes dizem sobre os produtos da sua loja." />

      <Alert tone="info" title="Avaliações só podem ser moderadas pela Mercatto">
        Vendedores não podem editar nem remover avaliações. Se uma avaliação tiver ofensas, dados pessoais ou não tiver relação com o produto, fale com o suporte da Mercatto.
      </Alert>

      <StoreReviewsSummary ratingAvg={store.ratingAvg} ratingCount={store.ratingCount} distribution={data.distribution} />
      <StoreReviewsFilter basePath={BASE_PATH} rating={rating} distribution={data.distribution} />
      <StoreReviewsList data={data} basePath={BASE_PATH} rating={rating} />
    </div>
  );
}
