import "server-only";
import { ufFromCep } from "@/lib/cep-ranges";

/** UF a partir do CEP (faixas dos Correios). */
export const ufFromCepSafe = (cep: string): string | null => ufFromCep(cep);
