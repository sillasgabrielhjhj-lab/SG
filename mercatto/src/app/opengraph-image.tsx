import { ImageResponse } from "next/og";
import { MercattoMark } from "@/components/brand/icon-art";

export const alt = "Mercatto — marketplace com ofertas oficiais e lojas parceiras";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0b5c4d 0%, #073d34 100%)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", borderRadius: 28, overflow: "hidden" }}>
            <MercattoMark size={112} />
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>mercatto</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>Compre com confiança.</div>
          <div style={{ fontSize: 30, color: "#cfe9e1" }}>Ofertas oficiais Mercatto e lojas parceiras verificadas · PIX e parcelamento</div>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, borderRadius: 5, background: "#f5b400" }} />
      </div>
    ),
    size,
  );
}
