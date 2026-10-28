import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Imagem de compartilhamento (WhatsApp, Facebook…), gerada sem foto. Quando houver uma foto real e
 * autorizada da May, você pode trocá-la: apague este arquivo e coloque `opengraph-image.jpg`
 * (1200×630) nesta pasta, com o texto alternativo em `opengraph-image.alt.txt`.
 */
export const alt = "Ajude May nessa caminhada — campanha solidária com doações por Pix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontFile = (name: string) =>
  readFile(join(process.cwd(), "node_modules/@fontsource/playfair-display/files", name));
const [regular, italic] = await Promise.all([
  fontFile("playfair-display-latin-600-normal.woff"),
  fontFile("playfair-display-latin-600-italic.woff"),
]);

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 96px",
        background: "linear-gradient(135deg, #fff6f8 0%, #fffbf8 45%, #f3edfb 100%)",
        fontFamily: "Playfair",
        color: "#2b1d2e",
        position: "relative",
      }}
    >
      <svg
        width="420"
        height="420"
        viewBox="0 0 24 24"
        fill="#ffe9ef"
        style={{ position: "absolute", right: -40, bottom: -70 }}
      >
        <path d={HEART} />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 30,
          color: "#a12d54",
          letterSpacing: 4,
        }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="#e0456f">
          <path d={HEART} />
        </svg>
        CAMPANHA SOLIDÁRIA
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", marginTop: 26, fontSize: 92, lineHeight: 1.05 }}
      >
        <span>Ajude&nbsp;</span>
        <span style={{ fontStyle: "italic", color: "#c23a66" }}>May</span>
        <span style={{ width: "100%" }}>nessa caminhada</span>
      </div>
      <div
        style={{ display: "flex", marginTop: 34, fontSize: 34, color: "#6b5c6e", maxWidth: 820 }}
      >
        Doe qualquer valor por Pix ou compartilhe esta campanha.
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Playfair", data: regular, weight: 600, style: "normal" },
        { name: "Playfair", data: italic, weight: 600, style: "italic" },
      ],
    },
  );
}
