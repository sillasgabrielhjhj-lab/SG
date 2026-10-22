/**
 * Copia TODOS os dados de um banco PostgreSQL (origem: Neon) para outro (destino: Supabase) que
 * já tem o mesmo schema, e confere o resultado tabela por tabela.
 *
 * Pré-requisito: o schema do destino já foi criado (`prisma migrate deploy` apontando para o
 * destino). Este script só move DADOS.
 *
 * Variáveis:
 *   SOURCE_DATABASE_URL   origem (Neon: URL SEM pooling, host sem "-pooler")
 *   TARGET_DATABASE_URL   destino (Supabase: "session pooler", host *.pooler.supabase.com, porta 5432)
 *   CONFIRM_REPLACE_TARGET=yes   obrigatório para copiar (o destino é esvaziado antes)
 *   ALLOW_NONEMPTY_TARGET=yes    permite copiar sobre um destino que já tem dados (CUIDADO)
 *   ALLOW_ANY_HOSTS=yes          desliga a validação de hosts (somente testes locais)
 *   SHOW_DETAILS=yes             no GitHub Actions, mostra hosts e contagens (por padrão ficam ocultos)
 *
 * Modos:
 *   (padrão)       copia tudo numa transação única; só confirma se contagens e checksums baterem
 *   --check        não altera nada; testa as conexões e compara versões, schema e tamanhos
 *   --verify-only  não altera nada; compara origem x destino
 *
 * Garantias:
 *   - a origem é lida em modo somente leitura, num snapshot único (REPEATABLE READ);
 *   - o destino roda numa transação: qualquer erro ou divergência desfaz tudo (rollback);
 *   - só copia para um destino "virgem" (só com as linhas que as migrations criam);
 *   - copia pelo protocolo COPY (formato texto, o mesmo do pg_dump): preserva jsonb, arrays, enums, datas;
 *   - colunas geradas (ex.: Product.searchVector) são recalculadas pelo próprio banco;
 *   - antes de confirmar, relê a origem: se pedidos/pagamentos mudaram durante a cópia, desfaz tudo;
 *   - nenhuma senha é impressa.
 */
import pg from "pg";
import { from as copyFrom, to as copyTo } from "pg-copy-streams";
import { pipeline } from "node:stream/promises";
import { setTimeout as sleep } from "node:timers/promises";

const { Client } = pg;

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
const VERIFY_ONLY = process.argv.includes("--verify-only");
const CHECK_ONLY = process.argv.includes("--check");
const yes = (name) => (process.env[name] ?? "").trim().toLowerCase() === "yes";
const CONFIRMED = yes("CONFIRM_REPLACE_TARGET");
const ALLOW_NONEMPTY = yes("ALLOW_NONEMPTY_TARGET");
const ALLOW_ANY_HOSTS = yes("ALLOW_ANY_HOSTS");
const IN_CI = process.env.GITHUB_ACTIONS === "true";
const QUIET = IN_CI && !yes("SHOW_DETAILS");

const SCHEMA = "public";
const SKIP_TABLES = new Set(["_prisma_migrations"]);
/** Linhas que as migrations inserem em qualquer banco novo (conferido com `prisma migrate deploy` num banco vazio). */
const MIGRATION_SEEDED_ROWS = { Coupon: 2, StoreSettings: 1 };
/** Se estas tabelas mudarem na origem durante a cópia, a cópia é desfeita (as demais só geram aviso). */
const CRITICAL_TABLES = new Set([
  "Order",
  "OrderItem",
  "OrderEvent",
  "Payment",
  "Checkout",
  "Refund",
  "Shipment",
  "WebhookEvent",
  "User",
  "Address",
  "CouponRedemption",
  "InventoryMovement",
]);
const SUPABASE_FREE_LIMIT_MB = 500;

class UserError extends Error {}
const fail = (msg) => {
  throw new UserError(msg);
};
const q = (id) => `"${String(id).replaceAll('"', '""')}"`;
const log = (msg = "") => console.log(msg);
const warn = (msg) => (IN_CI ? console.log(`::warning::${msg}`) : console.log(`  aviso: ${msg}`));
const pad = (s, n) => String(s).padEnd(n);

/** Interpreta a URL sem nunca incluir a senha em mensagens de erro. */
function parseUrl(name, value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    fail(
      `${name} não é um endereço de banco válido. Se a senha tem símbolos como # / ? @ %, troque-a por uma só com letras e números e gere o endereço de novo.`,
    );
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) fail(`${name} deve começar com postgresql://`);
  if (!u.hostname) fail(`${name} está sem o endereço do servidor.`);
  return u;
}

const normHost = (h) => h.toLowerCase().replace(/-pooler(?=\.)/, "");
const isSupabaseHost = (h) => /\.supabase\.(com|co)$/i.test(h);
const dbOf = (u) => decodeURIComponent(u.pathname.replace(/^\//, ""));

function validateEndpoints(src, dst) {
  if (
    normHost(src.hostname) === normHost(dst.hostname) &&
    dbOf(src) === dbOf(dst) &&
    (src.port || "5432") === (dst.port || "5432")
  ) {
    fail("origem e destino apontam para o mesmo banco.");
  }
  if (ALLOW_ANY_HOSTS) return;
  if (!/\.neon\.tech$/i.test(src.hostname))
    fail(
      "a origem não parece ser um banco Neon (o host deveria terminar em .neon.tech). Confira o segredo NEON_DATABASE_URL.",
    );
  if (/-pooler\./i.test(src.hostname))
    fail(
      "a origem usa a conexão COM pooling do Neon (host com -pooler). Use a conexão SEM pooling (DATABASE_URL_UNPOOLED).",
    );
  if (/^db\.[^.]+\.supabase\.co$/i.test(dst.hostname)) {
    fail(
      "o destino é a conexão DIRETA do Supabase, que só funciona por IPv6 (o GitHub Actions usa IPv4). Use a conexão 'Session pooler' (host terminando em .pooler.supabase.com, porta 5432).",
    );
  }
  if (!/\.pooler\.supabase\.com$/i.test(dst.hostname))
    fail(
      "o destino não parece ser o 'Session pooler' do Supabase (host terminando em .pooler.supabase.com). Confira o segredo SUPABASE_DATABASE_URL.",
    );
  if ((dst.port || "5432") !== "5432")
    fail(
      `o destino usa a porta ${dst.port}; para a cópia use o 'Session pooler' na porta 5432 (6543 é o modo transação, que não serve aqui).`,
    );
}

/** No GitHub Actions o log de repositório público é visível: esconde hosts, usuários e nomes de banco. */
function maskInCi(u) {
  if (!IN_CI) return;
  for (const v of [u.hostname, decodeURIComponent(u.username), dbOf(u)]) {
    if (v && v.length > 2) console.log(`::add-mask::${v}`);
  }
}

function describe(label, u) {
  return QUIET ? label : `${label} ${u.hostname}:${u.port || "5432"}/${dbOf(u)}`;
}

/** Parâmetros que só Prisma/libpq entendem são removidos; o SSL é configurado à parte. */
function cleanUrl(u) {
  const c = new URL(u.toString());
  for (const k of [
    "sslmode",
    "uselibpqcompat",
    "channel_binding",
    "pgbouncer",
    "schema",
    "connection_limit",
    "pool_timeout",
    "connect_timeout",
  ]) {
    c.searchParams.delete(k);
  }
  return c.toString();
}

const isLocalHost = (h) => ["localhost", "127.0.0.1", "::1"].includes(h);
const CERT_CHAIN_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);
const TRANSIENT_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "57P03"]);

/**
 * Conecta com SSL verificado. Só para o Supabase (CA própria, não reconhecida pelo Node) e só quando o
 * erro é "cadeia de certificado desconhecida" usa SSL sem verificação (o tráfego continua criptografado;
 * erros de hostname ou certificado expirado continuam falhando). Para o Neon nunca há fallback.
 */
async function connect(u, label) {
  const connectionString = cleanUrl(u);
  const sslOptions = isLocalHost(u.hostname) ? [false] : [true, { rejectUnauthorized: false }];
  let lastError;
  for (let i = 0; i < sslOptions.length; i++) {
    const ssl = sslOptions[i];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const client = new Client({
        connectionString,
        ssl,
        application_name: "mercatto-db-migrate",
        keepAlive: true,
        connectionTimeoutMillis: 30000,
      });
      client.on("error", (e) =>
        console.error(`${label}: conexão encerrada pelo servidor (${e.code ?? e.message}).`),
      );
      try {
        await client.connect();
        if (ssl && ssl.rejectUnauthorized === false)
          warn(
            `${label}: conectado com SSL sem verificação da cadeia de certificados (CA do Supabase não reconhecida pelo Node).`,
          );
        return client;
      } catch (e) {
        lastError = e;
        await client.end().catch(() => {});
        if (TRANSIENT_CODES.has(e.code) && attempt < 3) {
          await sleep(5000);
          continue;
        }
        break;
      }
    }
    const canFallback =
      i === 0 &&
      sslOptions.length > 1 &&
      isSupabaseHost(u.hostname) &&
      CERT_CHAIN_CODES.has(lastError?.code);
    if (!canFallback) break;
  }
  fail(
    `não consegui conectar na ${label}: ${lastError?.code ? `${lastError.code} ` : ""}${lastError?.message ?? "erro desconhecido"}`,
  );
}

async function listTables(c) {
  const { rows } = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
    [SCHEMA],
  );
  return rows.map((r) => r.tablename).filter((t) => !SKIP_TABLES.has(t));
}

async function appliedMigrations(c) {
  const { rows } = await c.query(
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name",
  );
  return rows.map((r) => r.migration_name);
}

/** Colunas graváveis (exclui as geradas pelo banco). */
async function writableColumns(c, table) {
  const { rows } = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND is_generated = 'NEVER'
      ORDER BY ordinal_position`,
    [SCHEMA, table],
  );
  return rows.map((r) => r.column_name);
}

async function countRows(c, table) {
  const { rows } = await c.query(`SELECT count(*)::bigint AS n FROM ${q(SCHEMA)}.${q(table)}`);
  return Number(rows[0].n);
}

/** Contagem + checksum do conteúdo (independente da ordem das linhas). */
async function fingerprint(c, table, cols) {
  const list = cols.map(q).join(", ");
  const { rows } = await c.query(
    `SELECT count(*)::bigint AS n, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS sum
       FROM (SELECT md5(ROW(${list})::text) AS h FROM ${q(SCHEMA)}.${q(table)}) x`,
  );
  return { n: Number(rows[0].n), sum: rows[0].sum };
}

async function fingerprintAll(c, tables, colsByTable) {
  const out = new Map();
  for (const t of tables) out.set(t, await fingerprint(c, t, colsByTable.get(t)));
  return out;
}

async function serverInfo(c) {
  const { rows } = await c.query(
    `SELECT version() AS v, current_setting('server_encoding') AS enc, current_setting('TimeZone') AS tz,
            d.datcollate AS collate, d.datctype AS ctype, pg_database_size(current_database())::bigint AS bytes
       FROM pg_database d WHERE d.datname = current_database()`,
  );
  const r = rows[0];
  return {
    version: r.v.split(" ").slice(0, 2).join(" "),
    enc: r.enc,
    tz: r.tz,
    collate: r.collate,
    ctype: r.ctype,
    mb: Math.round(Number(r.bytes) / 1048576),
  };
}

async function fixSequences(c, tables) {
  let fixed = 0;
  for (const table of tables) {
    const { rows } = await c.query(
      `SELECT column_name, pg_get_serial_sequence($1, column_name) AS seq
         FROM information_schema.columns WHERE table_schema = $2 AND table_name = $3`,
      [`${q(SCHEMA)}.${q(table)}`, SCHEMA, table],
    );
    for (const { column_name, seq } of rows) {
      if (!seq) continue;
      const max = await c.query(`SELECT max(${q(column_name)}) AS m FROM ${q(SCHEMA)}.${q(table)}`);
      if (max.rows[0].m === null) await c.query("SELECT setval($1, 1, false)", [seq]);
      else await c.query("SELECT setval($1, $2, true)", [seq, max.rows[0].m]);
      fixed++;
    }
  }
  return fixed;
}

/**
 * Fecha a API pública do Supabase (papéis anon/authenticated): revoga acessos e liga RLS em todas as
 * tabelas. O app conecta como dono das tabelas (papel postgres), que não é afetado.
 */
async function lockDownPublicRoles(c, tables) {
  const { rows } = await c.query(
    "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')",
  );
  if (!rows.length) return false;
  for (const { rolname } of rows) {
    await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${q(SCHEMA)} FROM ${q(rolname)}`);
    await c.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${q(SCHEMA)} FROM ${q(rolname)}`);
    await c.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${q(SCHEMA)} FROM ${q(rolname)}`);
    await c.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${q(SCHEMA)} REVOKE ALL ON TABLES FROM ${q(rolname)}`,
    );
    await c.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${q(SCHEMA)} REVOKE ALL ON SEQUENCES FROM ${q(rolname)}`,
    );
    await c.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${q(SCHEMA)} REVOKE ALL ON FUNCTIONS FROM ${q(rolname)}`,
    );
  }
  for (const t of tables)
    await c.query(`ALTER TABLE ${q(SCHEMA)}.${q(t)} ENABLE ROW LEVEL SECURITY`);
  return true;
}

async function main() {
  if (!SOURCE_URL || !TARGET_URL) fail("defina SOURCE_DATABASE_URL e TARGET_DATABASE_URL.");
  const srcUrl = parseUrl("SOURCE_DATABASE_URL", SOURCE_URL);
  const dstUrl = parseUrl("TARGET_DATABASE_URL", TARGET_URL);
  maskInCi(srcUrl);
  maskInCi(dstUrl);
  validateEndpoints(srcUrl, dstUrl);
  const copying = !VERIFY_ONLY && !CHECK_ONLY;
  if (copying && !CONFIRMED)
    fail("defina CONFIRM_REPLACE_TARGET=yes (o destino será esvaziado antes da cópia).");

  log(
    `Modo: ${CHECK_ONLY ? "teste de conexão" : VERIFY_ONLY ? "somente conferência" : "copiar e conferir"}`,
  );
  log(describe("Origem :", srcUrl));
  log(describe("Destino:", dstUrl));

  const src = await connect(srcUrl, "origem");
  const dst = await connect(dstUrl, "destino");
  let committed = false;
  let dstOpen = false;

  try {
    await src.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await src.query("SET LOCAL statement_timeout = 0");
    await src.query("SET LOCAL idle_in_transaction_session_timeout = 0");
    await src.query("SET LOCAL lock_timeout = '60s'");
    const snap = await src.query("SELECT now() AS at");
    log(`Snapshot da origem: ${snap.rows[0].at.toISOString()}`);

    const [si, di] = [await serverInfo(src), await serverInfo(dst)];
    log(`Versões : origem ${si.version} | destino ${di.version}`);
    log(`Tamanho : origem ${si.mb} MB | destino ${di.mb} MB`);
    if (si.enc !== "UTF8" || di.enc !== "UTF8")
      fail(`a codificação precisa ser UTF8 nos dois bancos (origem ${si.enc}, destino ${di.enc}).`);
    if (si.tz !== di.tz)
      warn(
        `fuso horário diferente (origem ${si.tz}, destino ${di.tz}): confira os horários após a migração.`,
      );
    if (si.collate !== di.collate || si.ctype !== di.ctype)
      warn(
        `collation diferente (origem ${si.collate}/${si.ctype}, destino ${di.collate}/${di.ctype}): a ordenação de textos pode mudar.`,
      );
    if (si.mb > SUPABASE_FREE_LIMIT_MB * 0.8)
      warn(
        `a origem tem ${si.mb} MB; o plano gratuito do Supabase comporta cerca de ${SUPABASE_FREE_LIMIT_MB} MB.`,
      );

    const srcTables = await listTables(src);
    const dstTables = await listTables(dst);
    if (srcTables.length === 0)
      fail(
        "a origem não tem nenhuma tabela no schema public. Confira o endereço do banco (NEON_DATABASE_URL).",
      );
    const missingInDst = srcTables.filter((t) => !dstTables.includes(t));
    if (missingInDst.length) {
      if (CHECK_ONLY)
        warn(
          `o destino ainda não tem ${missingInDst.length} tabela(s): normal antes do modo copiar (ele cria o schema antes).`,
        );
      else
        fail(
          `o destino não tem as tabelas: ${missingInDst.join(", ")}. Aplique o schema (prisma migrate deploy) no destino primeiro.`,
        );
    }
    const extraInDst = dstTables.filter((t) => !srcTables.includes(t));
    if (extraInDst.length && !CHECK_ONLY)
      fail(
        `o destino tem tabelas que a origem não tem: ${extraInDst.join(", ")}. As versões do schema são diferentes.`,
      );

    // O schema do destino precisa estar exatamente na mesma versão de migrations da origem.
    if (!missingInDst.length || !CHECK_ONLY) {
      const [ms, md] = [await appliedMigrations(src), await appliedMigrations(dst)];
      const onlySrc = ms.filter((m) => !md.includes(m));
      const onlyDst = md.filter((m) => !ms.includes(m));
      if (onlySrc.length || onlyDst.length) {
        fail(
          `as migrations aplicadas são diferentes. Só na origem: ${onlySrc.join(", ") || "nenhuma"}. Só no destino: ${onlyDst.join(", ") || "nenhuma"}. ` +
            "Se a origem está atrás, faça um Redeploy na Vercel (o build aplica as migrations) e tente de novo.",
        );
      }
    }

    if (CHECK_ONLY) {
      let rows = 0;
      for (const t of srcTables) rows += await countRows(src, t);
      let dstRows = 0;
      for (const t of dstTables) dstRows += await countRows(dst, t);
      log(`\nOrigem : ${srcTables.length} tabelas${QUIET ? "" : `, ${rows} linhas`}`);
      log(`Destino: ${dstTables.length} tabelas${QUIET ? "" : `, ${dstRows} linhas`}`);
      await src.query("ROLLBACK");
      log("\nConexões OK. Nada foi alterado.");
      return;
    }

    // Mesmo conjunto de colunas gravadas: nada da origem pode ficar de fora.
    const colsByTable = new Map();
    for (const t of srcTables) {
      const sc = await writableColumns(src, t);
      const dc = await writableColumns(dst, t);
      const lost = sc.filter((c) => !dc.includes(c));
      if (lost.length)
        fail(
          `a tabela ${t} do destino não tem as colunas ${lost.join(", ")}: os dados seriam perdidos.`,
        );
      const added = dc.filter((c) => !sc.includes(c));
      if (added.length)
        fail(
          `a tabela ${t} do destino tem colunas que a origem não tem (${added.join(", ")}). As versões do schema são diferentes.`,
        );
      colsByTable.set(t, sc);
    }

    if (copying) {
      // Trava de segurança: o destino precisa estar "virgem" (só as linhas criadas pelas migrations).
      if (!ALLOW_NONEMPTY) {
        for (const t of srcTables) {
          const nd = await countRows(dst, t);
          if (nd > (MIGRATION_SEEDED_ROWS[t] ?? 0)) {
            fail(
              `o destino já tem dados em ${t}. Para proteger um banco em uso, a cópia só roda sobre um destino vazio. Abortei sem alterar nada.`,
            );
          }
        }
      }

      await dst.query("BEGIN");
      dstOpen = true;
      await dst.query("SET LOCAL statement_timeout = 0");
      await dst.query("SET LOCAL idle_in_transaction_session_timeout = 0");
      await dst.query("SET LOCAL lock_timeout = '60s'");
      try {
        await dst.query("SET LOCAL session_replication_role = replica");
      } catch (e) {
        fail(
          `o destino não permite desligar a checagem de chaves estrangeiras durante a cópia (${e.message}). Avise o Claude com esta mensagem.`,
        );
      }
      await dst.query(
        `TRUNCATE TABLE ${srcTables.map((t) => `${q(SCHEMA)}.${q(t)}`).join(", ")} RESTART IDENTITY CASCADE`,
      );

      log("\nCopiando:");
      for (const t of srcTables) {
        const list = colsByTable.get(t).map(q).join(", ");
        await pipeline(
          src.query(copyTo(`COPY (SELECT ${list} FROM ${q(SCHEMA)}.${q(t)}) TO STDOUT`)),
          dst.query(copyFrom(`COPY ${q(SCHEMA)}.${q(t)} (${list}) FROM STDIN`)),
        );
        log(`  ${pad(t, 34)} ok`);
      }
      const seqs = await fixSequences(dst, srcTables);
      if (seqs) log(`  sequências reajustadas: ${seqs}`);
    }

    // Conferência (no modo cópia, ainda dentro da transação do destino).
    log("\nConferência:");
    const fpSrc = await fingerprintAll(src, srcTables, colsByTable);
    let divergent = 0;
    let totalRows = 0;
    for (const t of srcTables) {
      const a = fpSrc.get(t);
      const b = await fingerprint(dst, t, colsByTable.get(t));
      const same = a.n === b.n && a.sum === b.sum;
      totalRows += a.n;
      if (!same) divergent++;
      log(
        `  ${pad(t, 34)} ${QUIET ? "" : `origem ${pad(a.n, 7)} destino ${pad(b.n, 7)} `}${same ? "IGUAL" : "DIFERENTE"}`,
      );
    }
    log(
      `\nTabelas: ${srcTables.length}${QUIET ? "" : ` | linhas na origem: ${totalRows}`} | divergentes: ${divergent}`,
    );

    if (VERIFY_ONLY) {
      await src.query("ROLLBACK");
      if (divergent) fail("há diferenças entre origem e destino.");
      log("\nTudo igual.");
      return;
    }

    if (divergent)
      fail("a conferência encontrou diferenças. Nada foi gravado no destino (rollback).");

    // A origem pode ter recebido pedidos durante a cópia: relê num snapshot novo antes de confirmar.
    await src.query("ROLLBACK");
    if (process.env.MIGRATE_TEST_DRIFT_SQL) {
      const other = await connect(srcUrl, "origem (teste)");
      await other.query(process.env.MIGRATE_TEST_DRIFT_SQL);
      await other.end();
    }
    await src.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const fpAfter = await fingerprintAll(src, srcTables, colsByTable);
    await src.query("ROLLBACK");
    const drifted = srcTables.filter(
      (t) => fpAfter.get(t).sum !== fpSrc.get(t).sum || fpAfter.get(t).n !== fpSrc.get(t).n,
    );
    const criticalDrift = drifted.filter((t) => CRITICAL_TABLES.has(t));
    if (criticalDrift.length) {
      fail(
        `a origem recebeu dados novos durante a cópia (${criticalDrift.join(", ")}). Nada foi gravado no destino. ` +
          "Tente de novo num horário de pouco movimento (pause os anúncios por alguns minutos).",
      );
    }
    if (drifted.length)
      warn(
        `a origem teve mudanças sem impacto em pedidos durante a cópia (${drifted.join(", ")}): carrinhos, sessões ou estatísticas.`,
      );

    if (await lockDownPublicRoles(dst, srcTables))
      log("Acesso das funções públicas do Supabase (anon/authenticated) revogado e RLS ligado.");
    await dst.query("COMMIT");
    committed = true;
    dstOpen = false;
    log("\nCÓPIA CONCLUÍDA E CONFERIDA. O destino foi gravado.");
    log(
      `Pedidos novos na origem após ${new Date().toISOString()} NÃO estarão no destino: troque os endereços na Vercel logo em seguida.`,
    );
  } finally {
    if (dstOpen && !committed) await dst.query("ROLLBACK").catch(() => {});
    await src.query("ROLLBACK").catch(() => {});
    await src.end().catch(() => {});
    await dst.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(
    e instanceof UserError ? `\nERRO: ${e.message}` : `\nERRO inesperado: ${e?.message ?? e}`,
  );
  if (!(e instanceof UserError) && process.env.DEBUG_MIGRATE) console.error(e?.stack);
  process.exitCode = 1;
});
