import { Redis, type RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';
import { withTimeout } from './time.js';

/**
 * Conexões Redis.
 * - `redis`: conexão compartilhada para uso geral (lazy: só conecta no primeiro comando).
 * - `createRedisConnection('bullmq')`: nova conexão para BullMQ (exige maxRetriesPerRequest: null).
 */

function attachErrorLogging(conn: Redis, label: string): Redis {
  let lastLogged = 0;
  conn.on('error', (err) => {
    // evita inundar o log quando o Redis está fora do ar
    const nowMs = Date.now();
    if (nowMs - lastLogged > 10_000) {
      lastLogged = nowMs;
      logger.warn({ err: { message: err.message }, redis: label }, 'erro de conexão com o Redis');
    }
  });
  return conn;
}

export function createRedisConnection(role: 'general' | 'bullmq' = 'general', overrides: RedisOptions = {}): Redis {
  const options: RedisOptions =
    role === 'bullmq'
      ? { maxRetriesPerRequest: null, enableReadyCheck: true, ...overrides }
      : { maxRetriesPerRequest: 2, ...overrides };
  return attachErrorLogging(new Redis(env.REDIS_URL, options), role);
}

export const redis: Redis = createRedisConnection('general', { lazyConnect: true });
/** Aliases de conveniência. */
export const createRedis = createRedisConnection;
export const getRedis = (): Redis => redis;

/** Verifica conectividade com o Redis (usado por /ready). Nunca lança. */
export async function pingRedis(timeoutMs = 2000): Promise<boolean> {
  try {
    const reply = await withTimeout(redis.ping(), timeoutMs, 'redis');
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  try {
    if (redis.status === 'wait') redis.disconnect(); // nunca conectou (lazy): nada a encerrar com QUIT
    else if (redis.status !== 'end') await redis.quit();
  } catch {
    redis.disconnect();
  }
}
