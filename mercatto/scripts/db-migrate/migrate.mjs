/**
 * Copia TODOS os dados de um banco PostgreSQL (origem) para outro (destino) que já tem
 * o mesmo schema, e confere o resultado tabela por tabela.
 *
 * Pré-requisito: o schema do destino já foi criado (`prisma migrate deploy` apontando
 * para o destino). Este script só move DADOS.
 *
 * Variáveis:
 *   SOURCE_DATABASE_URL   banco de origem (Neon: use a URL SEM pooling)
 *   TARGET_DATABASE_URL   banco de destino (Supabase: conexão direta ou "session pooler", porta 5432)
 *   CONFIRM_REPLACE_TARGET=yes   obrigatório para copiar (o destino é esvaziado antes)
 *
 * Modos:
 *   (padrão)       copia tudo numa transação única; só confirma se contagens e checksums baterem
 *   --check        não altera nada; só testa as conexões e mostra versões e tamanhos
 *   --verify-only  não altera nada; apenas compara origem x destino
 *
 * Garantias:
 *   - origem é lida em modo somente leitura, num snapshot único (REPEATABLE READ);
 *   - destino roda numa transação: qualquer erro ou divergência desfaz tudo (rollback);
 *   - copia pelo protocolo COPY (formato texto), o mesmo do pg_dump: preserva jsonb, arrays, enums, datas;
 *   - colunas geradas (ex.: Product.searchVector) são recalculadas pelo próprio banco;
 *   - sequências são reajustadas ao maior valor copiado;
 *   - nenhuma senha é impressa.
 */
import pg from "pg";
import { from as copyFrom, to as copyTo } from "pg-copy-streams";
import { pipeline } from "node:stream/promises";

const { Client } = pg;

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
const VERIFY_ONLY = process.argv.includes("--verify-only");
const CHECK_ONLY = process.argv.includes("--check");
const CONFIRMED = (process.env.CONFIRM_REPLACE_TARGET ?? "").trim().toLowerCase() === "yes";
const SCHEMA = "public";
const SKIP_TABLES = new Set(["_prisma_migrations"]);
/** Linhas que as migrations inserem em qualquer banco novo (conferido com `prisma migrate deploy` num banco vazio). */
const MIGRATION_SEEDED_ROWS = { Coupon: 2, StoreSettings: 1 };

const q = (id) => `"${String(id).replaceAll('"', '""')}"`;
const log = (msg = "") => console.log(msg);
const fail = (msg) => {
  console.error(`\nERRO: ${msg}`);
  process.exit(1);
};

function describe(url) {
  const u = new URL(url);
  return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
}

/** Remove parâmetros que só o Prisma/libpq entendem; o SSL é configurado à parte. */
function cleanUrl(url) {
  const u = new URL(url);
  for (const k of ["sslmode", "uselibpqcompat", "channel_binding", "pgbouncer", "schema", "connection_limit", "pool_timeout", "connect_timeout"]) {
    u.searchParams.delete(k);
  }
  return u.toString();
}

const isLocal = (url) => ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

/** Conecta com SSL verificado; se o certificado do provedor não for reconhecido, avisa e usa SSL sem verificação. */
async function connect(url, label) {
  const connectionString = cleanUrl(url);
  const attempts = isLocal(url) ? [false] : [true, { rejectUnauthorized: false }];
  let lastError;
  for (const ssl of attempts) {
    const client = new Client({ connectionString, ssl, application_name: "mercatto-db-migrate" });
    try {
      await client.connect();
      if (ssl && ssl.rejectUnauthorized === false) log(`  aviso: ${label} conectado com SSL sem verificação de certificado.`);
      return client;
    } catch (e) {
      lastError = e;
      try {
        await client.end();
      } catch {}
      const certProblem = /certificate|self[- ]signed|unable to verify/i.test(String(e?.message));
      if (!certProblem) break;
    }
  }
  fail(`não consegui conectar em ${label} (${describe(url)}): ${lastError?.message ?? "erro desconhecido"}`);
}

async function listTables(c) {
  const { rows } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    [SCHEMA],
  );
  return rows.map((r) => r.table_name).filter((t) => !SKIP_TABLES.has(t));
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

async function fixSequences(c, tables) {
  let fixed = 0;
  for (const table of tables) {
    const { rows } = await c.query(
      `SELECT column_name, pg_get_serial_sequence($1, column_name) AS seq
         FROM information_schema.columns
        WHERE table_schema = $2 AND table_name = $3`,
      [`${q(SCHEMA)}.${q(table)}`, SCHEMA, table],
    );
    for (const { column_name, seq } of rows) {
      if (!seq) continue;
      const max = await c.query(`SELECT max(${q(column_name)}) AS m FROM ${q(SCHEMA)}.${q(table)}`);
      if (max.rows[0].m === null) await c.query(`SELECT setval($1, 1, false)`, [seq]);
      else await c.query(`SELECT setval($1, $2, true)`, [seq, max.rows[0].m]);
      fixed++;
    }
  }
  return fixed;
}

/** Fecha o acesso pela API pública do Supabase (anon/authenticated); o app usa o papel postgres e não é afetado. */
async function lockDownPublicRoles(c) {
  const { rows } = await c.query(`SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`);
  if (!rows.length) return false;
  for (const { rolname } of rows) {
    await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${q(SCHEMA)} FROM ${q(rolname)}`);
    await c.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${q(SCHEMA)} FROM ${q(rolname)}`);
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${q(SCHEMA)} REVOKE ALL ON TABLES FROM ${q(rolname)}`);
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${q(SCHEMA)} REVOKE ALL ON SEQUENCES FROM ${q(rolname)}`);
  }
  return true;
}

function pad(s, n) {
  return String(s).padEnd(n);
}

async function main() {
  if (!SOURCE_URL || !TARGET_URL) fail("defina SOURCE_DATABASE_URL e TARGET_DATABASE_URL.");
  if (cleanUrl(SOURCE_URL) === cleanUrl(TARGET_URL)) fail("origem e destino são o mesmo banco.");
  if (!VERIFY_ONLY && !CHECK_ONLY && !CONFIRMED) fail("defina CONFIRM_REPLACE_TARGET=yes (o destino será esvaziado antes da cópia).");

  log(`Modo: ${CHECK_ONLY ? "teste de conexão" : VERIFY_ONLY ? "somente conferência" : "copiar e conferir"}`);
  log(`Origem : ${describe(SOURCE_URL)}`);
  log(`Destino: ${describe(TARGET_URL)}`);

  const src = await connect(SOURCE_URL, "origem");
  const dst = await connect(TARGET_URL, "destino");
  let committed = false;

  try {
    await src.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snap = await src.query("SELECT now() AS at, version() AS v");
    log(`Snapshot da origem: ${snap.rows[0].at.toISOString()}`);
    log(`Versões: origem ${snap.rows[0].v.split(" ").slice(0, 2).join(" ")}`);
    const dv = await dst.query("SELECT version() AS v");
    log(`         destino ${dv.rows[0].v.split(" ").slice(0, 2).join(" ")}`);

    const srcTables = await listTables(src);
    const dstTables = await listTables(dst);

    if (CHECK_ONLY) {
      let rows = 0;
      for (const t of srcTables) rows += await countRows(src, t);
      let dstRows = 0;
      for (const t of dstTables) dstRows += await countRows(dst, t);
      log(`\nOrigem : ${srcTables.length} tabelas, ${rows} linhas`);
      log(`Destino: ${dstTables.length} tabelas, ${dstRows} linhas`);
      const missing = srcTables.filter((t) => !dstTables.includes(t));
      if (missing.length) log(`Destino ainda sem ${missing.length} tabela(s): rode o passo "copiar" (ele cria o schema antes).`);
      await src.query("ROLLBACK");
      log("\nConexões OK. Nada foi alterado.");
      return;
    }
    const missingInDst = srcTables.filter((t) => !dstTables.includes(t));
    if (missingInDst.length) fail(`o destino não tem as tabelas: ${missingInDst.join(", ")}. Aplique o schema (prisma migrate deploy) no destino primeiro.`);
    const extraInDst = dstTables.filter((t) => !srcTables.includes(t));
    if (extraInDst.length) log(`aviso: tabelas só no destino (ficam vazias): ${extraInDst.join(", ")}`);

    // Mesmo conjunto de colunas gravadas: nada da origem pode ficar de fora.
    const colsByTable = new Map();
    for (const t of srcTables) {
      const sc = await writableColumns(src, t);
      const dc = await writableColumns(dst, t);
      const lost = sc.filter((c) => !dc.includes(c));
      if (lost.length) fail(`a tabela ${t} do destino não tem as colunas ${lost.join(", ")}: os dados seriam perdidos. Aplique todas as migrations no destino.`);
      const added = dc.filter((c) => !sc.includes(c));
      if (added.length) log(`aviso: ${t} tem colunas novas só no destino (usarão o valor padrão): ${added.join(", ")}`);
      colsByTable.set(t, sc);
    }

    if (!VERIFY_ONLY) {
      // Trava de segurança: o destino não pode ter MAIS dados que a origem (exceto as linhas
      // que as próprias migrations criam num banco novo: 2 cupons e 1 configuração da loja).
      for (const t of srcTables) {
        const [ns, nd] = [await countRows(src, t), await countRows(dst, t)];
        if (nd > ns && nd > (MIGRATION_SEEDED_ROWS[t] ?? 0)) {
          fail(`o destino tem mais linhas que a origem em ${t} (${nd} > ${ns}). Isso parece um banco em uso; abortei sem alterar nada.`);
        }
      }

      await dst.query("BEGIN");
      await dst.query("SET LOCAL statement_timeout = 0");
      try {
        await dst.query("SET LOCAL session_replication_role = replica");
      } catch (e) {
        fail(`o destino não permite desligar a checagem de chaves estrangeiras durante a cópia (${e.message}). Avise o Claude com esta mensagem.`);
      }
      if (srcTables.length) {
        await dst.query(`TRUNCATE TABLE ${srcTables.map((t) => `${q(SCHEMA)}.${q(t)}`).join(", ")} RESTART IDENTITY CASCADE`);
      }

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
    log("\nConferência (linhas | checksum):");
    let divergent = 0;
    let totalRows = 0;
    for (const t of srcTables) {
      const cols = colsByTable.get(t);
      const a = await fingerprint(src, t, cols);
      const b = await fingerprint(dst, t, cols);
      const same = a.n === b.n && a.sum === b.sum;
      totalRows += a.n;
      if (!same) divergent++;
      log(`  ${pad(t, 34)} origem ${pad(a.n, 7)} destino ${pad(b.n, 7)} ${same ? "IGUAL" : "DIFERENTE"}`);
    }
    log(`\nTabelas: ${srcTables.length} | linhas na origem: ${totalRows} | divergentes: ${divergent}`);

    if (VERIFY_ONLY) {
      await src.query("ROLLBACK");
      if (divergent) fail("há diferenças entre origem e destino.");
      log("\nTudo igual.");
      return;
    }

    if (divergent) {
      await dst.query("ROLLBACK");
      fail("a conferência encontrou diferenças. Nada foi gravado no destino (rollback).");
    }

    if (await lockDownPublicRoles(dst)) log("Acesso das funções públicas do Supabase (anon/authenticated) revogado.");
    await dst.query("COMMIT");
    committed = true;
    await src.query("ROLLBACK");
    log("\nCÓPIA CONCLUÍDA E CONFERIDA. O destino foi gravado.");
  } finally {
    if (!committed && !VERIFY_ONLY) {
      try {
        await dst.query("ROLLBACK");
      } catch {}
    }
    await src.end().catch(() => {});
    await dst.end().catch(() => {});
  }
}

main().catch((e) => fail(e?.stack ?? String(e)));
