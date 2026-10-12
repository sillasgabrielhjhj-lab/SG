import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { memoize } from "@/server/memo";
import type { InstallmentConfig } from "@/lib/money";

/** Configurações globais da loja (linha única "default", criada sob demanda) — 60 s em memória. */
export const storeSettingsMemo = memoize(60_000, async () => {
  return (await db.storeSettings.findUnique({ where: { id: "default" } })) ?? db.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
});

export const getStoreSettings = cache(() => storeSettingsMemo.get());

export type StoreSettingsData = Awaited<ReturnType<typeof getStoreSettings>>;

export function installmentConfigFrom(settings: StoreSettingsData): InstallmentConfig {
  return {
    maxInstallments: settings.maxInstallments,
    interestFreeInstallments: settings.interestFreeInstallments,
    monthlyInterestBps: settings.monthlyInterestBps,
    minInstallmentCents: settings.minInstallmentCents,
  };
}
