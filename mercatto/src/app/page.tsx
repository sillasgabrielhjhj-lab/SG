import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroBanner } from "@/components/home/hero-banner";
import { PopularCategories } from "@/components/home/popular-categories";
import { ProductSection } from "@/components/home/product-section";
import { BenefitsSection } from "@/components/home/benefits-section";
import { deals, bestSellers, recommended } from "@/lib/mock-data";

export default function HomePage() {
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
