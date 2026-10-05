import { parseDemoProductParams } from "@/features/demo-art/catalog";
import { notFoundResponse, svgResponse } from "@/features/demo-art/http";
import { renderProductSvg } from "@/features/demo-art/render";

/** Ilustração vetorial de DEMONSTRAÇÃO: /demo-assets/p/[kind]/[color]/[view].svg */
export const dynamic = "force-static";
export const dynamicParams = true;

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; color: string; view: string }> }) {
  const parsed = parseDemoProductParams(await params);
  if (!parsed) return notFoundResponse();
  return svgResponse(renderProductSvg(parsed));
}
