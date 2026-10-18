#!/bin/sh
# Restaura (ou apenas VERIFICA) um backup do PostgreSQL do Achados VIP.
#
# Uso, a partir da raiz do projeto, no servidor:
#   ./infra/scripts/restore.sh                         lista os backups disponíveis
#   ./infra/scripts/restore.sh --verify <arq|latest>   restaura num banco TEMPORÁRIO e confere o conteúdo
#                                                      (NÃO toca no banco real; faça isso periodicamente!)
#   ./infra/scripts/restore.sh <arq|latest>            RESTAURA no banco real (pede confirmação)
#   ./infra/scripts/restore.sh --yes <arq|latest>      idem, sem perguntar
#   ./infra/scripts/restore.sh /caminho/backup.dump    restaura de um arquivo que está no servidor (fora do volume)
#
# Opções: --no-safety-backup   não faz o backup de segurança do estado atual antes de restaurar (não recomendado)
#
# <arq> é o nome do arquivo listado (ex.: achados-20261017T033000Z.dump.enc). "latest" = o mais recente.
# Backups cifrados com senha (.enc) usam BACKUP_PASSPHRASE do infra/.env. Backups cifrados com age (.age) exigem a
# chave PRIVADA, que não fica no servidor: decifre no seu computador (age -d -i chave.txt -o backup.dump x.dump.age)
# e restaure o .dump resultante informando o caminho do arquivo.
#
# Como a restauração é feita: api e worker são parados; é feito um backup de segurança do estado atual
# (prefixo achados-prerestore-); pg_restore --clean --single-transaction (tudo ou nada: se falhar, o banco fica como estava);
# api e worker sobem de novo (o serviço "migrate" reaplica migrations pendentes, se o backup for de uma versão antiga).
#
# Compatível com POSIX sh (dash/busybox ash).
set -eu

log() { printf '%s [restore] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERRO: $*" >&2; exit 1; }
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

# =====================================================================================================
# PARTE INTERNA — roda DENTRO do contêiner "backup" (tem pg_restore, as senhas e a pasta de backups)
# =====================================================================================================
if [ "${1:-}" = "--inner" ]; then
  [ "${IN_BACKUP_CONTAINER:-0}" = "1" ] || die "--inner só pode ser usado dentro do contêiner 'backup'"
  shift
  BACKUP_DIR=${BACKUP_DIR:-/backups}
  BACKUP_PREFIX=${BACKUP_PREFIX:-achados}
  BACKUP_PASSPHRASE=${BACKUP_PASSPHRASE:-}
  export BACKUP_PASSPHRASE
  MODE=restore
  SAFETY=1
  TARGET=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --list) MODE=list ;;
      --verify) MODE=verify ;;
      --no-safety-backup) SAFETY=0 ;;
      *) TARGET=$1 ;;
    esac
    shift
  done

  list_backups() {
    # shellcheck disable=SC2010  # nomes gerados por backup.sh (sem caracteres especiais); ls -t ordena por data
    ls -1t "$BACKUP_DIR" 2>/dev/null | grep -E "^${BACKUP_PREFIX}-[0-9]{8}T[0-9]{6}Z\.dump(\.enc|\.age)?\$" || true
  }

  if [ "$MODE" = list ]; then
    names=$(list_backups)
    if [ -z "$names" ]; then echo "(nenhum backup encontrado em $BACKUP_DIR)"; exit 0; fi
    echo "Backups disponíveis (do mais recente para o mais antigo):"
    echo "$names" | while IFS= read -r n; do
      printf '  %-48s %10s bytes  %s\n' "$n" "$(wc -c < "$BACKUP_DIR/$n" | tr -d ' ')" "$(date -r "$BACKUP_DIR/$n" '+%Y-%m-%d %H:%M' 2>/dev/null || echo '?')"
    done
    exit 0
  fi

  [ -n "$TARGET" ] || die "informe o arquivo de backup (ou 'latest')"
  case "$TARGET" in
    latest)
      name=$(list_backups | head -n 1)
      [ -n "$name" ] || die "nenhum backup encontrado em $BACKUP_DIR"
      file="$BACKUP_DIR/$name" ;;
    /tmp/restore-input*) file=$TARGET ;;
    */*) die "informe só o nome do arquivo (sem pasta)" ;;
    *) file="$BACKUP_DIR/$TARGET" ;;
  esac
  [ -f "$file" ] || die "arquivo não encontrado: $file"
  log "arquivo: $(basename "$file")"

  # integridade (SHA-256 gravado no momento do backup)
  if [ -f "$file.sha256" ]; then
    expected=$(cut -d' ' -f1 "$file.sha256")
    actual=$(sha256sum "$file" | cut -d' ' -f1)
    [ "$expected" = "$actual" ] || die "SHA-256 não confere: o arquivo está corrompido ou foi alterado"
    log "SHA-256 conferido"
  else
    log "aviso: sem arquivo .sha256 para conferir a integridade"
  fi

  umask 077
  work=$(mktemp -d /tmp/restore.XXXXXX)
  vdb=""
  cleanup() {
    rm -rf "$work"
    case "$file" in /tmp/restore-input*) rm -f "$file" "$file.sha256" ;; esac
    if [ -n "$vdb" ]; then psql -qAt -d postgres -c "DROP DATABASE IF EXISTS \"$vdb\"" >/dev/null 2>&1 || true; fi
  }
  trap cleanup EXIT

  case "$file" in
    *.dump.enc)
      [ -n "$BACKUP_PASSPHRASE" ] || die "este backup é cifrado com senha: defina BACKUP_PASSPHRASE no infra/.env (a mesma usada no backup)"
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$file" -out "$work/db.dump" \
        || die "falha ao decifrar: senha incorreta (BACKUP_PASSPHRASE) ou arquivo corrompido" ;;
    *.dump.age)
      die "backups .age exigem a chave privada (que não fica no servidor). Decifre no seu computador: age -d -i chave.txt -o backup.dump $(basename "$file") — e restaure com: ./infra/scripts/restore.sh /caminho/backup.dump" ;;
    *.dump)
      cp "$file" "$work/db.dump" ;;
    *) die "extensão não reconhecida (esperado .dump, .dump.enc ou .dump.age)" ;;
  esac
  pg_restore --list "$work/db.dump" >/dev/null || die "o arquivo não é um dump PostgreSQL válido (pg_restore --list falhou)"

  db=${PGDATABASE:?PGDATABASE não definido}

  if [ "$MODE" = verify ]; then
    vdb="${db}_restore_check"
    log "VERIFICAÇÃO: restaurando em um banco temporário ($vdb); o banco real não é alterado"
    PGOPTIONS="-c client_min_messages=warning" psql -qAt -d postgres -c "DROP DATABASE IF EXISTS \"$vdb\"" -c "CREATE DATABASE \"$vdb\"" >/dev/null
    pg_restore --no-owner --no-privileges --exit-on-error --dbname="$vdb" "$work/db.dump" \
      || die "a restauração de teste falhou — este backup NÃO é confiável"
    tables=$(psql -qAt -d "$vdb" -c "select count(*) from information_schema.tables where table_schema='public'")
    migrations=$(psql -qAt -d "$vdb" -c 'select count(*) from "_prisma_migrations"' 2>/dev/null || echo '?')
    log "restauração de teste OK: $tables tabelas, $migrations migrations registradas"
    for t in User Category Product Offer AffiliateLink Publication IntegrationCredential; do
      n=$(psql -qAt -d "$vdb" -c "select count(*) from \"$t\"" 2>/dev/null || echo 'n/d')
      printf '  %-22s %s linhas\n' "$t" "$n"
    done
    log "VERIFICAÇÃO CONCLUÍDA (banco temporário removido)"
    exit 0
  fi

  # ---- restauração real
  if [ "$SAFETY" = 1 ]; then
    log "backup de segurança do estado atual (prefixo ${BACKUP_PREFIX}-prerestore)..."
    BACKUP_PREFIX="${BACKUP_PREFIX}-prerestore" sh "$SCRIPT_DIR/backup.sh" --once \
      || die "o backup de segurança falhou; nada foi alterado. Corrija o problema ou use --no-safety-backup (por sua conta e risco)"
  else
    log "AVISO: restauração sem backup de segurança"
  fi
  log "restaurando em '$db' (tudo ou nada: --single-transaction)..."
  pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error \
      --dbname="$db" "$work/db.dump" \
    || die "pg_restore falhou. Por ser uma única transação, o banco permanece como estava antes."
  log "RESTAURAÇÃO CONCLUÍDA"
  exit 0
fi

# =====================================================================================================
# PARTE DO HOST — orquestra os contêineres
# =====================================================================================================
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.yml"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

YES=0; VERIFY=0; SAFETY_FLAG=""; TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --verify) VERIFY=1 ;;
    --no-safety-backup) SAFETY_FLAG="--no-safety-backup" ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    -*) die "opção desconhecida: $1" ;;
    *) [ -z "$TARGET" ] || die "informe apenas um arquivo"; TARGET=$1 ;;
  esac
  shift
done

command -v docker >/dev/null 2>&1 || die "docker não encontrado"
compose ps --status running --services 2>/dev/null | grep -qx backup \
  || die "o serviço 'backup' não está rodando. Suba-o com: docker compose -f infra/docker-compose.yml up -d backup"

if [ -z "$TARGET" ]; then
  compose exec -T backup sh /scripts/restore.sh --inner --list
  exit 0
fi

# arquivo local (fora do volume): envia por stdin para o contêiner (evita problema de dono/permissão do `docker cp`)
INNER_TARGET=$TARGET
if [ -f "$TARGET" ]; then
  case "$TARGET" in
    *.dump.enc) sfx=.dump.enc ;;
    *.dump.age) sfx=.dump.age ;;
    *) sfx=.dump ;;
  esac
  INNER_TARGET=/tmp/restore-input$sfx
  log "enviando $(basename "$TARGET") para o contêiner de backup..."
  compose exec -T backup sh -c "umask 077; cat > $INNER_TARGET" < "$TARGET" || die "falha ao enviar o arquivo"
  if [ -f "$TARGET.sha256" ]; then
    # o .sha256 original cita o nome antigo do arquivo; a parte interna compara só o hash
    compose exec -T backup sh -c "umask 077; cat > $INNER_TARGET.sha256" < "$TARGET.sha256" || die "falha ao enviar o .sha256"
  fi
fi

if [ "$VERIFY" = 1 ]; then
  compose exec -T backup sh /scripts/restore.sh --inner --verify "$INNER_TARGET"
  exit $?
fi

echo
echo "ATENÇÃO: isto SUBSTITUI todos os dados atuais do banco pelos do backup '$TARGET'."
echo "         Ofertas, links, publicações e credenciais criadas depois do backup serão perdidas."
echo "         A API e o worker serão parados durante a restauração."
if [ "$YES" != 1 ]; then
  printf 'Digite RESTAURAR para continuar: '
  read -r answer
  [ "$answer" = "RESTAURAR" ] || die "cancelado"
fi

log "parando api e worker..."
compose stop api worker

status=0
# shellcheck disable=SC2086
compose exec -T backup sh /scripts/restore.sh --inner $SAFETY_FLAG "$INNER_TARGET" || status=$?

log "subindo api e worker (o serviço 'migrate' reaplica migrations pendentes)..."
compose up -d api worker || log "AVISO: falha ao subir api/worker; rode: docker compose -f infra/docker-compose.yml up -d"

if [ "$status" -ne 0 ]; then
  log "A RESTAURAÇÃO FALHOU (status $status). O banco permanece como estava; api e worker foram religados."
  exit "$status"
fi
log "Concluído. Confira o painel e rode: ./infra/scripts/smoke.sh"
log "Dica: se as filas estiverem inconsistentes com o banco restaurado, limpe o Redis: docker compose -f infra/docker-compose.yml exec redis redis-cli FLUSHDB (as agendas são recriadas na subida do worker)."
