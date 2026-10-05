import { ImageResponse } from "next/og";
import { MercattoMark } from "@/components/brand/icon-art";

const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
};

export const dynamic = "force-static";
export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

/** Ícones PNG do PWA (maskable com área de segurança de 20%). */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<MercattoMark size={spec.size} padding={spec.maskable ? Math.round(spec.size * 0.2) : 0} />, {
    width: spec.size,
    height: spec.size,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
