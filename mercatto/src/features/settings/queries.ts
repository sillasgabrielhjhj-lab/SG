import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { InstallmentConfig } from "@/lib/money";

/** Configurações globais da loja (linha única "default", criada sob demanda). */
export const getStoreSettings = cache(async () => {
  return db.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
});

export type StoreSettingsData = Awaited<ReturnType<typeof getStoreSettings>>;

export function installmentConfigFrom(settings: StoreSettingsData): InstallmentConfig {
  return {
    maxInstallments: settings.maxInstallments,
    interestFreeInstallments: settings.interestFreeInstallments,
    monthlyInterestBps: settings.monthlyInterestBps,
    minInstallmentCents: settings.minInstallmentCents,
  };
}
