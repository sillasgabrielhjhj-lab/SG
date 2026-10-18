// Supervisor do deploy "tudo num serviço só" (Render): migrations + seed + admin inicial, depois API, worker e painel.
// Se QUALQUER processo cair, derruba os demais e sai com erro: o Render reinicia o serviço inteiro.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.env.APP_ROOT || '/app';
const API_DIR = process.env.API_DIR || path.join(ROOT, 'apps/api');
const WEB_SERVER = process.env.WEB_SERVER || path.join(ROOT, 'web/apps/web/server.js');
const WEB_PORT = process.env.PORT || '10000'; // porta pública definida pelo Render
const API_PORT = '3001';
const NODE = process.execPath;
const log = (msg) => console.log(JSON.stringify({ app: 'supervisor', msg, time: new Date().toISOString() }));

function runOnce(label, args, extraEnv = {}) {
  log(`${label}: iniciando`);
  const r = spawnSync(NODE, args, { cwd: API_DIR, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) {
    log(`${label}: FALHOU (código ${r.status})`);
    process.exit(1);
  }
  log(`${label}: ok`);
}

const bin = (name, rel) => {
  const p = path.join(ROOT, 'node_modules', rel);
  if (!existsSync(p)) {
    log(`binário ausente: ${name} (${p})`);
    process.exit(1);
  }
  return p;
};

// 1) migrations (somente "deploy") e seed idempotente (não sobrescreve edições do painel)
runOnce('migrate', [bin('prisma', 'prisma/build/index.js'), 'migrate', 'deploy']);
runOnce('seed', [bin('tsx', 'tsx/dist/cli.mjs'), 'prisma/seed.ts']);
// 2) administrador inicial: SOMENTE se ainda não existir nenhum usuário (nunca redefine senha trocada no painel)
const check = spawnSync(
  NODE,
  ['--input-type=module', '-e', "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); const n = await p.user.count(); await p.$disconnect(); console.log(n > 0 ? 'EXISTS' : 'EMPTY');"],
  { cwd: API_DIR, encoding: 'utf8', env: process.env },
);
if (check.status !== 0) {
  log('bootstrap-admin: não foi possível consultar usuários');
  process.exit(1);
}
if (check.stdout.trim() === 'EMPTY') {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    log('defina ADMIN_EMAIL e ADMIN_PASSWORD para criar o primeiro administrador');
    process.exit(1);
  }
  runOnce('create-admin', ['dist/scripts/create-admin.js']);
} else {
  log('administrador já existe; mantendo');
}

// 3) processos de longa duração
const children = [];
let stopping = false;
function start(name, args, env, cwd = API_DIR) {
  const c = spawn(NODE, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  children.push({ name, c });
  c.on('exit', (code, signal) => {
    if (stopping) return;
    log(`${name} encerrou (código ${code}, sinal ${signal}); derrubando o serviço para reinício`);
    shutdown(1);
  });
  log(`${name}: iniciado (pid ${c.pid})`);
}

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const { c } of children) c.kill('SIGTERM');
  const force = setTimeout(() => {
    for (const { c } of children) c.kill('SIGKILL');
    process.exit(code);
  }, 25_000);
  force.unref();
  let left = children.length;
  if (left === 0) process.exit(code);
  for (const { c } of children) c.on('exit', () => { if (--left === 0) process.exit(code); });
}
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

const heap = (mb) => `--max-old-space-size=${mb}`;
start('api', [heap(120), 'dist/server.js'], { PORT: API_PORT, HOST: '127.0.0.1' });
start('worker', [heap(120), 'dist/worker.js'], { PORT: API_PORT });
start('web', [heap(150), WEB_SERVER], { PORT: WEB_PORT, HOSTNAME: '0.0.0.0', NODE_ENV: 'production' }, path.dirname(WEB_SERVER));
