import "server-only";
import type { InstallmentConfig } from "@/lib/money";
import { installmentInterestPolicy } from "@/server/providers/payments";
import { installmentConfigFrom, type StoreSettingsData } from "@/features/settings/queries";

/**
 * Parcelamento exibido e cobrado conforme o gateway ativo. Na Stripe o
 * comprador paga o mesmo total em qualquer número de parcelas (parcelado
 * lojista), então todas as opções aparecem "sem juros".
 */
export function effectiveInstallmentConfig(settings: StoreSettingsData): InstallmentConfig {
  const config = installmentConfigFrom(settings);
  return installmentInterestPolicy() === "none" ? { ...config, interestFreeInstallments: config.maxInstallments } : config;
}
