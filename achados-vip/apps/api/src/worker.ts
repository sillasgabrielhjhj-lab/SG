import { disconnectDb } from './lib/db.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { closeRedis } from './lib/redis.js';
import { closeQueues, writeWorkerHeartbeat } from './queues/queues.js';
import { recoverOnBoot } from './queues/recovery.js';
import { syncSchedules } from './queues/scheduler.js';
import { startWorkers } from './queues/workers.js';
import { getSettings } from './services/settings.js';

for (const warning of env.warnings) logger.warn(warning);

await getSettings(); // garante a linha singleton e falha cedo se o banco estiver fora
const recovery = await recoverOnBoot(); // libera locks vencidos, marca jobs travados, reaplica agendadores
logger.info({ recovery }, 'recuperação de inicialização concluída');

const handle = startWorkers();
logger.info('workers iniciados (discovery, publish, maintenance)');

// batimento do worker (o painel/health usa para saber se há worker vivo) + reaplica agendadores se as settings mudaram
const heartbeat = setInterval(() => {
  void writeWorkerHeartbeat().catch((err) => logger.warn({ err: { message: String(err?.message ?? err) } }, 'falha ao gravar heartbeat'));
}, 30_000);
const resync = setInterval(() => {
  void syncSchedules().catch((err) => logger.warn({ err: { message: String(err?.message ?? err) } }, 'falha ao reaplicar agendadores'));
}, 60_000);
void writeWorkerHeartbeat().catch(() => undefined);

let shuttingDown = false;
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'encerrando worker');
  clearInterval(heartbeat);
  clearInterval(resync);
  const force = setTimeout(() => {
    logger.error('encerramento forçado após timeout');
    process.exit(1);
  }, 30_000);
  force.unref();
  try {
    await handle.close(); // aguarda jobs em andamento
    await closeQueues();
    await Promise.allSettled([disconnectDb(), closeRedis()]);
  } catch (err) {
    logger.error({ err }, 'erro ao encerrar worker');
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  void shutdown('uncaughtException', 1);
});
