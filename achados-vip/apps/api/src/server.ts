import { buildApp } from './app.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { disconnectDb } from './lib/db.js';
import { closeRedis } from './lib/redis.js';
import { purgeExpiredSessions } from './services/auth.js';
import { getSettings } from './services/settings.js';

const app = await buildApp({ logger: true });

for (const warning of env.warnings) logger.warn(warning);

let shuttingDown = false;
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'encerrando servidor');
  // se o encerramento travar, força a saída
  const force = setTimeout(() => {
    logger.error('encerramento forçado após timeout');
    process.exit(1);
  }, 10_000);
  force.unref();
  try {
    await app.close(); // para de aceitar conexões e aguarda requisições em andamento
    await Promise.allSettled([disconnectDb(), closeRedis()]);
  } catch (err) {
    logger.error({ err }, 'erro ao encerrar');
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  void shutdown('uncaughtException', 1);
});

try {
  await getSettings(); // garante a linha singleton de configurações (e falha cedo se o banco estiver fora)
  await purgeExpiredSessions();
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  logger.fatal({ err }, 'falha ao iniciar o servidor');
  await Promise.allSettled([disconnectDb(), closeRedis()]);
  process.exit(1);
}
