import "server-only";
import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on("error", () => {
      // Redis indisponível não deve derrubar a aplicação — apenas o
      // rate limit fica "aberto" (fail-open) nesse caso.
    });
  }
  return redis;
}

type RateLimitResult = { allowed: boolean; remaining: number };

/**
 * Janela fixa simples (fixed window) baseada em INCR + EXPIRE no Redis.
 * `key` deve identificar a ação + o ator (ex: "login:ip:1.2.3.4" ou
 * "login:email:foo@bar.com") para limitar por IP e por conta ao mesmo
 * tempo.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const client = getRedis();
    const fullKey = `ratelimit:${key}`;
    const count = await client.incr(fullKey);
    if (count === 1) {
      await client.expire(fullKey, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}
