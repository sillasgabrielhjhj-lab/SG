import { GoalSection } from "@/components/home/GoalSection";
import { Hero } from "@/components/home/Hero";
import { HowToHelp } from "@/components/home/HowToHelp";
import { JourneySection } from "@/components/home/JourneySection";
import { PhotosSection } from "@/components/home/PhotosSection";
import { StorySection } from "@/components/home/StorySection";
import { Transparency } from "@/components/home/Transparency";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { fundraisingView, getFundraising } from "@/lib/fundraising";
import { getSiteUrl } from "@/lib/site-url";

export default async function HomePage() {
  const snapshot = await getFundraising();
  const siteUrl = getSiteUrl();
  const view = fundraisingView(snapshot);

  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <Hero progress={view.kind === "progress" ? view.progress : null} snapshot={snapshot} />
        <StorySection view={view} siteUrl={siteUrl} />
        <PhotosSection />
        <JourneySection />
        <GoalSection snapshot={snapshot} />
        <HowToHelp siteUrl={siteUrl} />
        <Transparency />
      </main>
      <SiteFooter />
    </>
  );
}
