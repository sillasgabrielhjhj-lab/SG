import "server-only";
import { env } from "@/server/env";
import { MelhorEnvioShippingProvider } from "@/server/providers/shipping/melhorenvio";
import { TableShippingProvider } from "@/server/providers/shipping/table";
import type { ShippingProvider } from "@/server/providers/shipping/types";

let instance: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  instance ??= env.SHIPPING_PROVIDER === "melhorenvio" ? new MelhorEnvioShippingProvider(env.MELHORENVIO_TOKEN ?? "") : new TableShippingProvider();
  return instance;
}
