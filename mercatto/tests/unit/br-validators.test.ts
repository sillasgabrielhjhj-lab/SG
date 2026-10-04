import { describe, expect, it } from "vitest";
import { addressSchema, isValidCep, isValidCnpj, isValidCpf, isValidPhone } from "@/lib/validators/br";
import { formatCep, formatCpf, formatPhone } from "@/lib/format";

describe("validadores brasileiros", () => {
  it("valida CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("valida CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });

  it("valida CEP e telefone", () => {
    expect(isValidCep("01001-000")).toBe(true);
    expect(isValidCep("0100100")).toBe(false);
    expect(isValidCep("00000000")).toBe(false);
    expect(isValidPhone("(11) 98765-4321")).toBe(true);
    expect(isValidPhone("(11) 3456-7890")).toBe(true);
    expect(isValidPhone("(11) 88765-4321")).toBe(false);
    expect(isValidPhone("(05) 98765-4321")).toBe(false);
  });

  it("formata máscaras", () => {
    expect(formatCep("01001000")).toBe("01001-000");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("normaliza endereço via schema", () => {
    const parsed = addressSchema.parse({
      recipientName: "Ana Souza",
      cep: "01001-000",
      street: "Praça da Sé",
      number: "100",
      district: "Sé",
      city: "São Paulo",
      state: "sp",
      phone: "(11) 98765-4321",
      complement: "",
    });
    expect(parsed.cep).toBe("01001000");
    expect(parsed.state).toBe("SP");
    expect(parsed.phone).toBe("11987654321");
    expect(parsed.complement).toBeUndefined();
    expect(() => addressSchema.parse({ ...parsed, cep: "123", state: "XX" })).toThrow();
  });
});
