import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagem de compartilhamento (WhatsApp, Facebook, etc.). Para usar uma foto real do Tobias,
// salve uma imagem 1200×630 como src/app/opengraph-image.jpg e apague este arquivo.
export const alt = "Todos pelo Tobias — campanha solidária. Doe qualquer valor por Pix.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (pkg: string, file: string) =>
  readFile(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file));

export default async function OpenGraphImage() {
  const [titleFont, bodyFont] = await Promise.all([
    font("fraunces", "fraunces-latin-700-normal.woff"),
    font("plus-jakarta-sans", "plus-jakarta-sans-latin-500-normal.woff"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 90px",
          background: "linear-gradient(135deg, #1b6a43 0%, #134430 60%, #082a1c 100%)",
          color: "#ffffff",
          fontFamily: "Jakarta",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 24px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.14)",
              fontSize: 26,
              letterSpacing: 4,
            }}
          >
            CAMPANHA SOLIDÁRIA
          </div>
          <div style={{ display: "flex", marginTop: 34, fontFamily: "Fraunces", fontWeight: 700, fontSize: 104, lineHeight: 1.02 }}>
            TODOS PELO TOBIAS
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 38, lineHeight: 1.3, color: "#bde6cd" }}>
            Doe qualquer valor por Pix ou compartilhe a campanha.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 330,
            height: 330,
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.18)",
          }}
        >
          <svg width="200" height="200" viewBox="0 0 24 24" fill="#e5484d">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: titleFont, weight: 700, style: "normal" },
        { name: "Jakarta", data: bodyFont, weight: 500, style: "normal" },
      ],
    },
  );
}
