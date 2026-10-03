import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroBanner } from "@/components/home/hero-banner";
import { PopularCategories } from "@/components/home/popular-categories";
import { ProductSection } from "@/components/home/product-section";
import { BenefitsSection } from "@/components/home/benefits-section";
import { getHomeSections } from "@/lib/data/catalog";

export default async function HomePage() {
  const { deals, bestSellers, recommended, under50, under100, under200 } = await getHomeSections();

  return (
    <>
      <Header />

      <main id="main" className="flex-1 pb-16">
        <HeroBanner />
        <PopularCategories />
        {deals.length > 0 && (
          <ProductSection
            title="Ofertas de lançamento Mercatto"
            seeAllHref="/search?q=ofertas"
            products={deals}
          />
        )}
        <ProductSection
          title="Mais vendidos"
          seeAllHref="/search?q=mais-vendidos"
          products={bestSellers}
        />
        <ProductSection
          title="Recomendados para você"
          seeAllHref="/search?q=recomendados"
          products={recommended}
        />
        {under50.length > 0 && (
          <ProductSection title="Até R$ 50" seeAllHref="/search?max=50" products={under50} />
        )}
        {under100.length > 0 && (
          <ProductSection title="Até R$ 100" seeAllHref="/search?max=100" products={under100} />
        )}
        {under200.length > 0 && (
          <ProductSection title="Até R$ 200" seeAllHref="/search?max=200" products={under200} />
        )}
        <BenefitsSection />
      </main>

      <Footer />
    </>
  );
}
