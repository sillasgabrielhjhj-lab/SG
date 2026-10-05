import "server-only";
import { providerRequest } from "@/server/providers/http";
import type { CepAddress, CepProvider } from "@/server/providers/cep/types";

type ViaCepResponse = { cep?: string; logradouro?: string; complemento?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean | string };

/** ViaCEP (serviço público, sem credenciais). Falha de rede lança — a UI oferece preenchimento manual. */
export class ViaCepProvider implements CepProvider {
  readonly name = "viacep";
  async lookup(cep: string): Promise<CepAddress | null> {
    const digits = cep.replace(/\D/g, "");
    const { data } = await providerRequest<ViaCepResponse>({
      provider: this.name,
      url: `https://viacep.com.br/ws/${digits}/json/`,
      timeoutMs: 4000,
      userMessage: "Serviço de CEP indisponível. Preencha o endereço manualmente.",
      acceptStatuses: [400],
    });
    if (!data || data.erro) return null;
    return {
      cep: digits,
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
      complement: data.complemento || undefined,
    };
  }
}

/** Sem consulta externa: sempre exige preenchimento manual. */
export class NoCepProvider implements CepProvider {
  readonly name = "none";
  async lookup(): Promise<CepAddress | null> {
    throw new Error("Consulta de CEP desativada (CEP_PROVIDER=none).");
  }
}
