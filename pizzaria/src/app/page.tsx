import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { MobileOrderBar } from '@/components/layout/mobile-order-bar';
import { About } from '@/components/sections/about';
import { Contact } from '@/components/sections/contact';
import { FinalCta } from '@/components/sections/final-cta';
import { Gallery } from '@/components/sections/gallery';
import { Hero } from '@/components/sections/hero';
import { Highlights } from '@/components/sections/highlights';
import { Marquee } from '@/components/sections/marquee';
import { MenuSection } from '@/components/sections/menu-section';
import { Reviews } from '@/components/sections/reviews';
import { jsonLdScript, restaurantJsonLd } from '@/lib/seo';

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(restaurantJsonLd())} />
      <Header />
      <main id="conteudo">
        <Hero />
        <Marquee />
        <Highlights />
        <MenuSection />
        <About />
        <Reviews />
        <Gallery />
        <Contact />
        <FinalCta />
      </main>
      <Footer />
      <MobileOrderBar />
    </>
  );
}
