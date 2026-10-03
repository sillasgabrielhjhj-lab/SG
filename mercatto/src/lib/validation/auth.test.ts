import { describe, it, expect } from "vitest";

import { registerSchema, loginSchema, resetPasswordSchema } from "@/lib/validation/auth";

describe("registerSchema", () => {
  it("aceita dados válidos", () => {
    const result = registerSchema.safeParse({
      name: "Maria Silva",
      email: "maria@example.com",
      password: "SenhaForte123",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = registerSchema.safeParse({
      name: "Maria Silva",
      email: "não-é-um-email",
      password: "SenhaForte123",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha sem letra maiúscula", () => {
    const result = registerSchema.safeParse({
      name: "Maria Silva",
      email: "maria@example.com",
      password: "senhafraca123",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha sem número", () => {
    const result = registerSchema.safeParse({
      name: "Maria Silva",
      email: "maria@example.com",
      password: "SenhaSemNumero",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha curta demais", () => {
    const result = registerSchema.safeParse({
      name: "Maria Silva",
      email: "maria@example.com",
      password: "Ab1",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita nome muito curto", () => {
    const result = registerSchema.safeParse({
      name: "M",
      email: "maria@example.com",
      password: "SenhaForte123",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita e-mail e senha preenchidos", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "qualquer" });
    expect(result.success).toBe(true);
  });

  it("rejeita senha vazia", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("exige a mesma política de senha forte do cadastro", () => {
    const result = resetPasswordSchema.safeParse({ token: "abc", password: "fraca" });
    expect(result.success).toBe(false);
  });

  it("aceita senha forte com token", () => {
    const result = resetPasswordSchema.safeParse({ token: "abc", password: "NovaSenha123" });
    expect(result.success).toBe(true);
  });
});
