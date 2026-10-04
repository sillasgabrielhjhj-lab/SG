import { describe, expect, it } from "vitest";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/dates";
import { promotionInputSchema } from "@/features/marketing/schemas";

describe("datas (horário de Brasília)", () => {
  it("converte datetime-local de Brasília para UTC e volta", () => {
    const d = parseLocalDateTime("2026-10-05T10:00")!;
    expect(d.toISOString()).toBe("2026-10-05T13:00:00.000Z");
    expect(toLocalInputValue(d)).toBe("2026-10-05T10:00");
    expect(parseLocalDateTime("05/10/2026")).toBeNull();
  });

  it("valida promoção: término depois do início, percentual máximo e alvo obrigatório", () => {
    const base = { name: "Relâmpago", type: "PERCENT_OFF", value: 20, startsAt: "2026-10-05T10:00", endsAt: "2026-10-05T18:00", productIds: ["p1"] };
    expect(promotionInputSchema.safeParse(base).success).toBe(true);
    expect(promotionInputSchema.safeParse({ ...base, endsAt: "2026-10-05T09:00" }).success).toBe(false);
    expect(promotionInputSchema.safeParse({ ...base, value: 95 }).success).toBe(false);
    expect(promotionInputSchema.safeParse({ ...base, productIds: [] }).success).toBe(false);
    expect(promotionInputSchema.safeParse({ ...base, isFlash: "on", productIds: [], categoryIds: ["c1"] }).success).toBe(false);
  });
});
