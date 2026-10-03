// Limpa os contadores de rate limit (Redis) antes de rodar a suíte E2E,
// pra testes repetidos não baterem nos limites de abuso (login, cadastro
// etc.) e falharem por um motivo que não tem nada a ver com o app.
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const keys = await redis.keys("ratelimit:*");
if (keys.length > 0) {
  await redis.del(...keys);
  console.log(`Limpos ${keys.length} contadores de rate limit.`);
} else {
  console.log("Nenhum contador de rate limit para limpar.");
}

await redis.quit();
