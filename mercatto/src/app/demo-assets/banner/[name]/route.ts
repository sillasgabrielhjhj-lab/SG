import { parseDemoBannerParam } from "@/features/demo-art/catalog";
import { notFoundResponse, svgResponse } from "@/features/demo-art/http";
import { renderBannerSvg } from "@/features/demo-art/render";

/** Banner vetorial de DEMONSTRAÇÃO (1600×600, sem texto): /demo-assets/banner/[name].svg */
export const dynamic = "force-static";
export const dynamicParams = true;

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = parseDemoBannerParam((await params).name);
  if (!name) return notFoundResponse();
  return svgResponse(renderBannerSvg(name));
}
