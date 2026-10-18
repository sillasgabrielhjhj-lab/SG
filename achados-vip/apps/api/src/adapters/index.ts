/** Fábricas de adaptadores. Fontes de ofertas: ver ./sources/index.ts. */
export { createSource, getConfiguredSource } from './sources/index.js';
export type { CreateSourceOptions } from './sources/index.js';

/** Adaptadores de publicação (WhatsApp Groups API, fila manual, Telegram, webhook). */
export { createPublisher, channelFormat, isAutomaticChannel, AdapterConfigError } from './publishers/index.js';
export type { ChannelLike, CredentialValues } from './publishers/index.js';
