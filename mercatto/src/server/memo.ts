import "server-only";

/**
 * Cache em memória por instância do servidor, com validade curta. Para dados
 * lidos em TODA página e que quase não mudam (configurações, categorias):
 * evita consultar o banco a cada acesso — essencial com tráfego de robôs e
 * plano de banco com cota.
 */
export function memoize<T>(ttlMs: number, load: () => Promise<T>): { get: () => Promise<T>; clear: () => void } {
  let value: { data: T; at: number } | null = null;
  let pending: Promise<T> | null = null;
  return {
    get() {
      if (value && Date.now() - value.at < ttlMs) return Promise.resolve(value.data);
      pending ??= load()
        .then((data) => {
          value = { data, at: Date.now() };
          return data;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    clear() {
      value = null;
    },
  };
}
