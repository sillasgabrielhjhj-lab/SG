import { describe, expect, it } from "vitest";

import {
  DEMO_ART_COLORS,
  DEMO_ART_KINDS,
  DEMO_ART_VIEWS,
  DEMO_BANNER_NAMES,
  demoProductGallery,
  parseDemoBannerParam,
  parseDemoProductParams,
} from "@/features/demo-art/catalog";
import { renderBannerSvg, renderProductSvg } from "@/features/demo-art/render";

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';
const MAX_BYTES = 25 * 1024;

function ids(svg: string): string[] {
  return [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? "");
}

function expectSafeSvg(svg: string, viewBox: string) {
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg).toContain(`viewBox="${viewBox}"`);
  expect(svg.endsWith("</svg>")).toBe(true);
  expect(svg.toLowerCase()).not.toContain("<script");
  expect(svg.toLowerCase()).not.toMatch(/\son\w+=/);
  expect(svg.toLowerCase()).not.toContain("javascript:");
  expect(svg.toLowerCase()).not.toContain("<text");
  // único "http" permitido é o namespace SVG obrigatório para servir como imagem
  expect(svg.replace(SVG_NS, "")).not.toContain("http");
  // href só para referências internas (<use href="#...">)
  for (const m of svg.matchAll(/href="([^"]*)"/g)) expect(m[1]?.startsWith("#")).toBe(true);
  // toda referência url(#id) aponta para um id definido
  const defined = new Set(ids(svg));
  for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(defined.has(m[1] ?? "")).toBe(true);
}

describe("renderProductSvg", () => {
  const colors = ["black", "pink"] as const;
  const seen = new Set<string>();

  for (const kind of DEMO_ART_KINDS) {
    it(`gera SVGs válidos para "${kind}" (2 cores × 3 vistas)`, () => {
      for (const color of colors) {
        for (const view of DEMO_ART_VIEWS) {
          const svg = renderProductSvg({ kind, color, view });
          expectSafeSvg(svg, "0 0 800 800");
          expect(Buffer.byteLength(svg)).toBeLessThan(MAX_BYTES);
          const list = ids(svg);
          const prefix = `${kind}-${color}-${view}-`;
          expect(list.length).toBeGreaterThan(0);
          expect(new Set(list).size).toBe(list.length);
          for (const id of list) {
            expect(id.startsWith(prefix)).toBe(true);
            expect(seen.has(id)).toBe(false);
            seen.add(id);
          }
        }
      }
    });
  }

  it("é determinístico", () => {
    expect(renderProductSvg({ kind: "tire", color: "silver", view: "2" })).toBe(renderProductSvg({ kind: "tire", color: "silver", view: "2" }));
  });

  it("cores diferentes produzem desenhos diferentes", () => {
    const a = renderProductSvg({ kind: "sneaker", color: "red", view: "1" });
    const b = renderProductSvg({ kind: "sneaker", color: "blue", view: "1" });
    expect(a.replaceAll("sneaker-red-1", "")).not.toBe(b.replaceAll("sneaker-blue-1", ""));
  });

  it("aceita todas as cores do catálogo", () => {
    for (const color of DEMO_ART_COLORS) expect(renderProductSvg({ kind: "smartphone", color, view: "1" })).toContain("<svg");
  });

  it("lança erro para kind, cor ou vista inválidos", () => {
    expect(() => renderProductSvg({ kind: "spaceship", color: "black", view: "1" })).toThrow();
    expect(() => renderProductSvg({ kind: "laptop", color: "rainbow", view: "1" })).toThrow();
    expect(() => renderProductSvg({ kind: "laptop", color: "black", view: "4" })).toThrow();
    expect(() => renderProductSvg({ kind: "", color: "", view: "" })).toThrow();
  });
});

describe("renderBannerSvg", () => {
  for (const name of DEMO_BANNER_NAMES) {
    it(`gera banner "${name}" 1600×600 sem texto`, () => {
      const svg = renderBannerSvg(name);
      expectSafeSvg(svg, "0 0 1600 600");
      const list = ids(svg);
      expect(new Set(list).size).toBe(list.length);
      for (const id of list) expect(id.startsWith(`banner-${name}-`)).toBe(true);
    });
  }

  it("lança erro para banner inválido", () => {
    expect(() => renderBannerSvg("xmas")).toThrow();
  });
});

describe("parâmetros de rota", () => {
  it("valida segmentos de produto", () => {
    expect(parseDemoProductParams({ kind: "laptop", color: "silver", view: "2.svg" })).toEqual({ kind: "laptop", color: "silver", view: "2" });
    expect(parseDemoProductParams({ kind: "laptop", color: "silver", view: "2" })).toBeNull();
    expect(parseDemoProductParams({ kind: "laptop", color: "silver", view: "9.svg" })).toBeNull();
    expect(parseDemoProductParams({ kind: "nope", color: "silver", view: "1.svg" })).toBeNull();
  });

  it("valida segmento de banner", () => {
    expect(parseDemoBannerParam("tech.svg")).toBe("tech");
    expect(parseDemoBannerParam("tech")).toBeNull();
    expect(parseDemoBannerParam("other.svg")).toBeNull();
  });

  it("monta a galeria com as 3 vistas", () => {
    expect(demoProductGallery("sofa", "beige")).toEqual([
      "/demo-assets/p/sofa/beige/1.svg",
      "/demo-assets/p/sofa/beige/2.svg",
      "/demo-assets/p/sofa/beige/3.svg",
    ]);
  });
});
