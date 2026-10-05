import "server-only";
import { env } from "@/server/env";
import { NoCepProvider, ViaCepProvider } from "@/server/providers/cep/viacep";
import type { CepProvider } from "@/server/providers/cep/types";

let instance: CepProvider | null = null;

export function getCepProvider(): CepProvider {
  instance ??= env.CEP_PROVIDER === "none" ? new NoCepProvider() : new ViaCepProvider();
  return instance;
}
