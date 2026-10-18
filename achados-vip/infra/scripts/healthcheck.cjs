'use strict';
/**
 * Healthcheck sem dependências, usado pelas imagens Docker (api, worker, web).
 *
 *   node healthcheck.cjs http [url]   -> GET na URL (padrão: http://127.0.0.1:$PORT/health); sai 0 se status 2xx
 *   node healthcheck.cjs redis        -> AUTH (se REDIS_URL tiver senha) + PING no Redis de REDIS_URL; sai 0 se PONG
 *
 * Códigos de saída: 0 = saudável, 1 = não saudável. Nunca imprime senhas.
 */
const mode = process.argv[2] || 'http';
const TIMEOUT_MS = 4000;

function fail(msg) {
  console.error('healthcheck:', msg);
  process.exit(1);
}

setTimeout(() => fail('timeout'), TIMEOUT_MS + 500).unref();

if (mode === 'http') {
  const url = process.argv[3] || `http://127.0.0.1:${process.env.PORT || 3001}/health`;
  fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' })
    .then((res) => (res.status >= 200 && res.status < 400 ? process.exit(0) : fail(`HTTP ${res.status}`)))
    .catch((err) => fail(err && err.message ? err.message : 'erro de conexão'));
} else if (mode === 'redis') {
  const net = require('node:net');
  let target;
  try {
    target = new URL(process.env.REDIS_URL || '');
  } catch {
    fail('REDIS_URL ausente ou inválida');
  }
  const bulk = (s) => `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
  const password = decodeURIComponent(target.password || '');
  const username = decodeURIComponent(target.username || '');
  let payload = '';
  if (password) {
    payload += username ? `*3\r\n${bulk('AUTH')}${bulk(username)}${bulk(password)}` : `*2\r\n${bulk('AUTH')}${bulk(password)}`;
  }
  payload += `*1\r\n${bulk('PING')}`;

  const socket = net.connect({ host: target.hostname, port: Number(target.port) || 6379 });
  socket.setTimeout(TIMEOUT_MS, () => fail('timeout ao falar com o Redis'));
  socket.on('error', (err) => fail(err.message));
  socket.on('connect', () => socket.write(payload));
  let buf = '';
  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    if (buf.includes('+PONG')) {
      socket.destroy();
      process.exit(0);
    }
    // respostas de erro do Redis começam com "-" (ex.: -WRONGPASS, -NOAUTH)
    if (/(^|\r\n)-/.test(buf)) fail('Redis recusou o comando (verifique a senha em REDIS_URL)');
  });
} else {
  fail(`modo desconhecido: ${mode}`);
}
