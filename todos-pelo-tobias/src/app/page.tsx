import { CampaignCard } from "@/components/home/CampaignCard";
import { Hero } from "@/components/home/Hero";
import { HowToHelp } from "@/components/home/HowToHelp";
import { PhotosSection } from "@/components/home/PhotosSection";
import { Story } from "@/components/home/Story";
import { Trust } from "@/components/home/Trust";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getFundraising } from "@/lib/fundraising";
import { getSiteUrl } from "@/lib/site-url";

export default async function HomePage() {
  const goal = await getFundraising();

  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <Hero goal={goal} />
        <CampaignCard />
        <Story />
        <PhotosSection />
        <HowToHelp siteUrl={getSiteUrl()} />
        <Trust />
      </main>
      <SiteFooter />
    </>
  );
}
