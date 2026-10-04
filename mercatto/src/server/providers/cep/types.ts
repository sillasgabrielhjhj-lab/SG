export type CepAddress = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
  complement?: string;
};

export interface CepProvider {
  readonly name: string;
  /** Retorna null quando o CEP não existe; lança em falha de rede (permitindo fallback manual). */
  lookup(cep: string): Promise<CepAddress | null>;
}
