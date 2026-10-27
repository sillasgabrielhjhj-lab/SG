import { parsePix } from "pix-utils";
import { describe, expect, it } from "vitest";
import { buildShareMessage, facebookShareUrl, whatsappShareUrl } from "@/lib/share";
import {
  buildStaticPix,
  detectPixKeyType,
  formatPixAmount,
  PixError,
  sanitizeText,
} from "@/lib/pix/brcode";
import { crc16 } from "@/lib/pix/crc16";
import { resolvePixSetup } from "@/lib/pix/setup";

const BASE = {
  key: "tobiasvaquinha87@gmail.com",
  receiverName: "Nome Teste",
  receiverCity: "Cidade Teste",
  description: "Todos pelo Tobias",
};

/** Decodifica um campo EMV (ID + tamanho + valor) em lista, validando os tamanhos. */
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
  it("bate com os vetores de referência (calculados à parte em Python: binascii.crc_hqx)", () => {
    expect(crc16("123456789")).toBe("29B1"); // vetor padrão da especificação do algoritmo
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

      // CRC: últimos 4 dígitos = CRC16 de tudo que vem antes (incluindo "6304")
      expect(code.slice(-8, -4)).toBe("6304");
      expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));

      // estrutura EMV: IDs em ordem crescente e tamanhos coerentes
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
      expect(get("00")).toBe("01");
      expect(get("53")).toBe("986");
      expect(get("58")).toBe("BR");
      expect(get("59")).toBe("NOME TESTE");
      expect(get("60")).toBe("CIDADE TESTE");
      expect(get("54")).toBe(formatPixAmount(cents));
      expect(get("54")).toMatch(/^\d+\.\d{2}$/);

      // conta do recebedor (campo 26): GUI do Pix + chave de e-mail
      const account = parseTlv(get("26") ?? "");
      expect(account[0]).toEqual(["00", "br.gov.bcb.pix"]);
      expect(account[1]).toEqual(["01", BASE.key]);
    },
  );

  it("o valor do QR Code é exatamente o escolhido (R$ 50,00 -> 50.00)", () => {
    expect(buildStaticPix({ ...BASE, amountCents: 5000 })).toContain("540550.00");
    expect(buildStaticPix({ ...BASE, amountCents: 1999 })).toContain("540519.99");
  });

  it("é lido sem erros por um parser independente (pix-utils): CRC, chave, nome, cidade e valor", () => {
    for (const cents of [500, 2550, 10000]) {
      const parsed = parsePix(buildStaticPix({ ...BASE, amountCents: cents }));
      expect(parsed).toMatchObject({
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

  it("sem valor, deixa o pagador digitar (sem campo 54)", () => {
    const fields = parseTlv(buildStaticPix(BASE));
    expect(fields.map(([id]) => id)).not.toContain("54");
  });

  it("normaliza a chave de e-mail para minúsculas", () => {
    const code = buildStaticPix({
      ...BASE,
      key: "  TobiasVaquinha87@Gmail.com ",
      amountCents: 100,
    });
    expect(code).toContain("tobiasvaquinha87@gmail.com");
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "recusa o valor inválido %s",
    (cents) => {
      expect(() => buildStaticPix({ ...BASE, amountCents: cents })).toThrow(PixError);
    },
  );

  it("recusa chave, nome e cidade inválidos ou vazios", () => {
    expect(() => buildStaticPix({ ...BASE, key: "nao-e-uma-chave" })).toThrow(/chave/i);
    expect(() => buildStaticPix({ ...BASE, receiverName: "  " })).toThrow(/nome/i);
    expect(() => buildStaticPix({ ...BASE, receiverCity: "!!!" })).toThrow(/cidade/i);
  });
});

describe("sanitizeText", () => {
  it("remove acentos e símbolos, usa maiúsculas e respeita o limite", () => {
    expect(sanitizeText("Maria D'Ávila Conceição", 25)).toBe("MARIA DAVILA CONCEICAO");
    expect(sanitizeText("São José dos Pinhais do Sul", 15)).toBe("SAO JOSE DOS PI");
    expect(sanitizeText("  a   b  ", 25)).toBe("A B");
  });
});

describe("detectPixKeyType", () => {
  it("reconhece os 5 tipos de chave", () => {
    expect(detectPixKeyType("tobiasvaquinha87@gmail.com")).toBe("email");
    expect(detectPixKeyType("+5511999999999")).toBe("phone");
    expect(detectPixKeyType("12345678901")).toBe("cpf");
    expect(detectPixKeyType("12345678000199")).toBe("cnpj");
    expect(detectPixKeyType("123e4567-e12b-12d1-a456-426655440000")).toBe("random");
    expect(detectPixKeyType("texto qualquer")).toBeNull();
  });
});

describe("resolvePixSetup", () => {
  const cfg = {
    key: BASE.key,
    receiverName: "",
    receiverCity: "",
    description: "Todos pelo Tobias",
  };

  it("só com a chave Pix já funciona: usa valores neutros e não exibe recebedor", () => {
    expect(resolvePixSetup(cfg, "Todos pelo Tobias")).toEqual({
      key: BASE.key,
      description: "Todos pelo Tobias",
      payloadName: "Todos pelo Tobias",
      payloadCity: "BRASIL",
    });
  });

  it("o código gerado só com a chave é um BR Code válido (lido pelo parser independente)", () => {
    const setup = resolvePixSetup(cfg, "Todos pelo Tobias");
    const code = buildStaticPix({
      key: setup.key,
      receiverName: setup.payloadName,
      receiverCity: setup.payloadCity,
      description: setup.description,
      amountCents: 5000,
    });
    expect(parsePix(code)).toMatchObject({
      type: "STATIC",
      pixKey: BASE.key,
      merchantName: "TODOS PELO TOBIAS",
      merchantCity: "BRASIL",
      transactionAmount: 50,
    });
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });

  it("se nome e cidade forem informados, são usados no código e exibidos", () => {
    const setup = resolvePixSetup(
      { ...cfg, receiverName: " Fulano ", receiverCity: "Recife" },
      "Todos pelo Tobias",
    );
    expect(setup).toMatchObject({
      payloadName: "Fulano",
      payloadCity: "Recife",
      receiver: { name: "Fulano", city: "Recife" },
    });
  });

  it("só o nome informado: cidade neutra no código e só o nome é exibido", () => {
    const setup = resolvePixSetup({ ...cfg, receiverName: "Fulano" }, "Todos pelo Tobias");
    expect(setup).toMatchObject({
      payloadName: "Fulano",
      payloadCity: "BRASIL",
      receiver: { name: "Fulano" },
    });
    expect(setup.receiver).not.toHaveProperty("city");
  });
});

describe("compartilhamento", () => {
  it("monta a mensagem pronta com o link da campanha", () => {
    const message = buildShareMessage("https://exemplo.com");
    expect(message).toContain("❤️ TODOS PELO TOBIAS ❤️");
    expect(message).toContain("💚 Doe qualquer valor por Pix ou compartilhe esta campanha.");
    expect(message.endsWith("🔗 https://exemplo.com")).toBe(true);
  });

  it("codifica os links do WhatsApp e do Facebook", () => {
    expect(whatsappShareUrl("a b\nc")).toBe("https://wa.me/?text=a%20b%0Ac");
    expect(facebookShareUrl("https://exemplo.com/?a=1&b=2")).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexemplo.com%2F%3Fa%3D1%26b%3D2",
    );
  });
});
