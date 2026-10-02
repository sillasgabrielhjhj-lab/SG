import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroBanner } from "@/components/home/hero-banner";
import { PopularCategories } from "@/components/home/popular-categories";
import { ProductSection } from "@/components/home/product-section";
import { BenefitsSection } from "@/components/home/benefits-section";
import { getHomeSections } from "@/lib/data/catalog";

export default async function HomePage() {
  const { deals, bestSellers, recommended } = await getHomeSections();

  return (
    <>
      <Header />

      <main id="main" className="flex-1 pb-16">
        <HeroBanner />
        <PopularCategories />
        <ProductSection
          title="Ofertas relâmpago"
          seeAllHref="/search?q=ofertas"
          products={deals}
        />
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
        <BenefitsSection />
      </main>

      <Footer />
    </>
  );
}
