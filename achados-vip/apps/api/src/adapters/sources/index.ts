/** Fábrica das fontes de ofertas. `settings.monitoring.source` escolhe a implementação. */
import type { Settings } from '../../domain/settings.js';
import type { OfferSource } from '../../domain/types.js';
import { loadMlCredentials, saveRotatedCredentials } from './credentials.js';
import { FixtureSource, type FixtureOptions } from './fixture.js';
import { MercadoLivreApiSource, type MercadoLivreOptions, type MlCredentials } from './mercadolivre.js';

export interface CreateSourceOptions {
  fixture?: FixtureOptions;
  /** Sobrescreve opções do adaptador do ML (testes/simulador). Por padrão a base vem de ML_API_BASE_URL (opcional). */
  mercadolivre?: Partial<Omit<MercadoLivreOptions, 'credentials'>>;
}

export function createSource(settings: Settings, credentials: MlCredentials | null, opts: CreateSourceOptions = {}): OfferSource {
  if (settings.monitoring.source === 'fixture') return new FixtureSource(opts.fixture);
  const baseUrl = process.env.ML_API_BASE_URL?.trim();
  return new MercadoLivreApiSource({
    credentials,
    ...(baseUrl ? { baseUrl } : {}),
    onRefreshTokenRotated: saveRotatedCredentials,
    reloadCredentials: loadMlCredentials,
    ...opts.mercadolivre,
  });
}

/** Cria a fonte configurada, carregando as credenciais (banco com fallback para o ambiente). */
export async function getConfiguredSource(settings: Settings, opts: CreateSourceOptions = {}): Promise<OfferSource> {
  const credentials = settings.monitoring.source === 'fixture' ? null : await loadMlCredentials();
  return createSource(settings, credentials, opts);
}

export { FixtureSource, MercadoLivreApiSource };
export type { MlCredentials };
