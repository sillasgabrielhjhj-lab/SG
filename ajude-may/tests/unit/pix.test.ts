import { parsePix } from "pix-utils";
import { describe, expect, it } from "vitest";
import {
  buildStaticPix,
  detectPixKeyType,
  formatPixAmount,
  normalizePixKey,
  PixError,
  sanitizeText,
} from "@/lib/pix/brcode";
import { crc16 } from "@/lib/pix/crc16";
import { resolvePixSetup } from "@/lib/pix/setup";

// Chave fictícia (domínio reservado para exemplos). A chave real da May vai em PIX_KEY.
const BASE = {
  key: "chave-teste@example.com",
  receiverName: "Nome Teste",
  receiverCity: "Cidade Teste",
  description: "Ajude May",
};

/** Decodifica campos EMV (ID + tamanho + valor), validando os tamanhos. */
function parseTlv(text: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    const value = text.slice(i + 4, i + 4 + len);
    expect(value).toHaveLength(len);
    out.push([id, value]);
    i += 4 + len;
  }
  return out;
}

describe("crc16 (CCITT-FALSE)", () => {
  it("bate com os vetores de referência (binascii.crc_hqx em Python)", () => {
    expect(crc16("123456789")).toBe("29B1");
    expect(crc16("")).toBe("FFFF");
    expect(
      crc16(
        "00020126330014br.gov.bcb.pix0111teste@x.com5204000053039865802BR5904Nome6004Cida62070503***6304",
      ),
    ).toBe("1566");
  });
});

describe("buildStaticPix", () => {
  it.each([500, 1000, 2000, 5000, 10000, 1, 1005, 123456])(
    "monta um BR Code válido para %i centavos",
    (cents) => {
      const code = buildStaticPix({ ...BASE, amountCents: cents });
      expect(code.slice(-8, -4)).toBe("6304");
      expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));

      const fields = parseTlv(code);
      expect(fields.map(([id]) => id)).toEqual([
        "00",
        "01",
        "26",
        "52",
        "53",
        "54",
        "58",
        "59",
        "60",
        "62",
        "63",
      ]);
      const get = (id: string) => fields.find(([f]) => f === id)?.[1];
      expect(get("53")).toBe("986");
      expect(get("54")).toBe(formatPixAmount(cents));
      const account = parseTlv(get("26") ?? "");
      expect(account[0]).toEqual(["00", "br.gov.bcb.pix"]);
      expect(account[1]).toEqual(["01", BASE.key]);
    },
  );

  it("o valor do QR Code é exatamente o escolhido (R$ 20,00 -> 20.00)", () => {
    expect(buildStaticPix({ ...BASE, amountCents: 2000 })).toContain("540520.00");
    expect(buildStaticPix({ ...BASE, amountCents: 1999 })).toContain("540519.99");
  });

  it("é lido por um parser independente (pix-utils): CRC, chave, nome, cidade e valor", () => {
    for (const cents of [500, 2000, 2550, 10000]) {
      expect(parsePix(buildStaticPix({ ...BASE, amountCents: cents }))).toMatchObject({
        type: "STATIC",
        pixKey: BASE.key,
        merchantName: "NOME TESTE",
        merchantCity: "CIDADE TESTE",
        transactionAmount: cents / 100,
        transactionCurrency: "986",
        countryCode: "BR",
      });
    }
  });

  it("o parser independente rejeita o código se qualquer caractere for alterado", () => {
    const code = buildStaticPix({ ...BASE, amountCents: 5000 });
    expect(parsePix(code.replace("50.00", "51.00"))).toMatchObject({ error: true });
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("recusa o valor %s", (cents) => {
    expect(() => buildStaticPix({ ...BASE, amountCents: cents })).toThrow(PixError);
  });

  it("recusa chave, nome e cidade inválidos ou vazios", () => {
    expect(() => buildStaticPix({ ...BASE, key: "nao-e-uma-chave" })).toThrow(/chave/i);
    expect(() => buildStaticPix({ ...BASE, receiverName: "  " })).toThrow(/nome/i);
    expect(() => buildStaticPix({ ...BASE, receiverCity: "!!!" })).toThrow(/cidade/i);
  });
});

describe("chaves Pix", () => {
  it("normaliza os formatos digitados para o formato do Pix", () => {
    expect(normalizePixKey("  Doacoes@Example.com ")).toBe("doacoes@example.com");
    expect(normalizePixKey("+55 (11) 99999-8888")).toBe("+5511999998888");
    expect(normalizePixKey("529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizePixKey("123E4567-E12B-12D1-A456-426655440000")).toBe(
      "123e4567-e12b-12d1-a456-426655440000",
    );
  });

  it("reconhece os 5 tipos e confere os dígitos de CPF e CNPJ", () => {
    expect(detectPixKeyType("doacoes@example.com")).toBe("email");
    expect(detectPixKeyType("+5511999998888")).toBe("phone");
    expect(detectPixKeyType("529.982.247-25")).toBe("cpf");
    expect(detectPixKeyType("11.222.333/0001-81")).toBe("cnpj");
    expect(detectPixKeyType("123e4567-e12b-12d1-a456-426655440000")).toBe("random");
    expect(detectPixKeyType("529.982.247-24")).toBeNull(); // dígito errado
    expect(detectPixKeyType("11.222.333/0001-80")).toBeNull();
    expect(detectPixKeyType("111.111.111-11")).toBeNull();
    expect(detectPixKeyType("11999998888")).toBeNull(); // telefone sem +55 não passa por CPF
    expect(detectPixKeyType("texto qualquer")).toBeNull();
  });

  it("CPF formatado entra no código só com números", () => {
    const parsed = parsePix(buildStaticPix({ ...BASE, key: "529.982.247-25", amountCents: 100 }));
    expect(parsed).toMatchObject({ pixKey: "52998224725" });
  });
});

describe("sanitizeText", () => {
  it("remove acentos e símbolos, usa maiúsculas e respeita o limite", () => {
    expect(sanitizeText("Maria D'Ávila Conceição", 25)).toBe("MARIA DAVILA CONCEICAO");
    expect(sanitizeText("São José dos Pinhais do Sul", 15)).toBe("SAO JOSE DOS PI");
  });
});

describe("resolvePixSetup (PIX_KEY, PIX_RECEIVER_NAME, PIX_RECEIVER_CITY)", () => {
  const cfg = { key: "", receiverName: "", receiverCity: "", description: "Ajude May" };

  it("sem chave configurada: null (o site não gera QR Code de exemplo)", () => {
    expect(resolvePixSetup(cfg, "Ajude May")).toBeNull();
    expect(resolvePixSetup({ ...cfg, key: "   " }, "Ajude May")).toBeNull();
  });

  it("chave inválida interrompe o build com mensagem clara", () => {
    expect(() => resolvePixSetup({ ...cfg, key: "11999998888" }, "Ajude May")).toThrow(
      /PIX_KEY inválida.*\+55/,
    );
  });

  it("só com a chave: valores neutros no código e nenhum nome exibido", () => {
    const setup = resolvePixSetup({ ...cfg, key: " Doacoes@Example.com " }, "Ajude May")!;
    expect(setup).toEqual({
      key: "doacoes@example.com",
      description: "Ajude May",
      payloadName: "Ajude May",
      payloadCity: "BRASIL",
    });
    const code = buildStaticPix({
      key: setup.key,
      receiverName: setup.payloadName,
      receiverCity: setup.payloadCity,
      description: setup.description,
      amountCents: 2000,
    });
    expect(parsePix(code)).toMatchObject({
      pixKey: "doacoes@example.com",
      merchantName: "AJUDE MAY",
      merchantCity: "BRASIL",
      transactionAmount: 20,
    });
  });

  it("com nome e cidade: entram no código e o nome é exibido para conferência", () => {
    const setup = resolvePixSetup(
      { ...cfg, key: BASE.key, receiverName: " Fulana de Tal ", receiverCity: "Recife" },
      "Ajude May",
    );
    expect(setup).toMatchObject({
      payloadName: "Fulana de Tal",
      payloadCity: "Recife",
      receiver: { name: "Fulana de Tal", city: "Recife" },
    });
  });
});
