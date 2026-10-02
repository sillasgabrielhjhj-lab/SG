import { describe, it, expect } from "vitest";

import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("converte para minúsculas e troca espaços por hífen", () => {
    expect(slugify("Tênis Esportivo Runner")).toBe("tenis-esportivo-runner");
  });

  it("remove acentos", () => {
    expect(slugify("Informática")).toBe("informatica");
    expect(slugify("Automóveis")).toBe("automoveis");
  });

  it("remove caracteres especiais", () => {
    expect(slugify("Fone de Ouvido (Novo!) 50%OFF")).toBe("fone-de-ouvido-novo-50-off");
  });

  it("não deixa hífen no começo ou no fim", () => {
    expect(slugify("  Produto Teste  ")).toBe("produto-teste");
  });

  it("colapsa múltiplos separadores em um único hífen", () => {
    expect(slugify("Produto   com --- espaços")).toBe("produto-com-espacos");
  });
});
